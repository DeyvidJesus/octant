import type { WorkMode } from '@/types/job'
import type { SeniorityLevel } from '@/types/analysis'
import type { DiscoveredCandidate } from '@/types/discovery'
import type { SearchProfile } from '@/types/searchProfile'

/**
 * Continuous learning (Phase 4). Every reaction the user has to a discovered job (approve / dismiss /
 * save / apply / mark interesting) is captured as a feature row; a DETERMINISTIC aggregation turns
 * those into learned preferences that (a) re-rank the feed and (b) bias future search strategies. No
 * extra AI cost — the model isn't in this loop; it just consumes the augmented profile.
 */

export type SignalAction = 'approved' | 'dismissed' | 'saved' | 'applied' | 'interested'

/** How strongly each action moves preference weights. Applying is the strongest positive signal. */
const ACTION_WEIGHT: Record<SignalAction, number> = {
  applied: 2,
  approved: 1,
  saved: 1,
  interested: 1,
  dismissed: -1,
}

export interface SignalFeatures {
  company?: string
  role?: string
  technologies: string[]
  workMode?: WorkMode
  salaryRange?: string
  seniority?: SeniorityLevel
  score?: number
}

export interface DiscoverySignal {
  action: SignalAction
  features: SignalFeatures
}

export interface LearnedPreferences {
  /** Net weight per technology (positive = user gravitates toward it). */
  technologyScores: Record<string, number>
  /** Net weight per work mode. */
  workModeScores: Partial<Record<WorkMode, number>>
  /** Companies the user repeatedly dismisses (net-negative) — excluded from future searches. */
  dislikedCompanies: string[]
}

/** Extracts the learnable features from a candidate (the job's stack is the strongest signal). */
export function buildSignalFeatures(candidate: DiscoveredCandidate): SignalFeatures {
  const technologies = candidate.analysis?.detectedStack.map((s) => s.canonical) ?? []
  return {
    company: candidate.company,
    role: candidate.role,
    technologies: Array.from(new Set(technologies)),
    workMode: candidate.workMode,
    salaryRange: candidate.salaryRange,
    seniority: candidate.analysis?.detectedSeniority,
    score: candidate.matchScore,
  }
}

/** Aggregates raw signals into learned preferences (pure, deterministic). */
export function learnPreferences(signals: DiscoverySignal[]): LearnedPreferences {
  const technologyScores: Record<string, number> = {}
  const workModeScores: Partial<Record<WorkMode, number>> = {}
  const companyNet: Record<string, number> = {}

  for (const signal of signals) {
    const weight = ACTION_WEIGHT[signal.action] ?? 0
    for (const tech of signal.features.technologies) {
      technologyScores[tech] = (technologyScores[tech] ?? 0) + weight
    }
    if (signal.features.workMode && signal.features.workMode !== 'unknown') {
      const mode = signal.features.workMode
      workModeScores[mode] = (workModeScores[mode] ?? 0) + weight
    }
    if (signal.features.company) {
      companyNet[signal.features.company] = (companyNet[signal.features.company] ?? 0) + weight
    }
  }

  const dislikedCompanies = Object.entries(companyNet)
    .filter(([, net]) => net <= -2)
    .map(([company]) => company)

  return { technologyScores, workModeScores, dislikedCompanies }
}

const MAX_LEARNED_TECHS = 5

/** Positive-weight technologies, strongest first. */
function preferredTechnologies(prefs: LearnedPreferences): string[] {
  return Object.entries(prefs.technologyScores)
    .filter(([, score]) => score > 0)
    .sort((a, b) => b[1] - a[1])
    .map(([tech]) => tech)
    .slice(0, MAX_LEARNED_TECHS)
}

/**
 * Biases a resolved SearchProfile with what we've learned: preferred technologies are folded in, and
 * repeatedly-dismissed companies are excluded. Both deterministic and AI strategy generation consume
 * the augmented profile, so learning flows into search with zero extra AI calls.
 */
export function applyLearnedToProfile(profile: SearchProfile, prefs: LearnedPreferences): SearchProfile {
  const learnedTechs = preferredTechnologies(prefs).filter((t) => !profile.technologies.includes(t))
  const excludeCompanies = prefs.dislikedCompanies.filter((c) => !profile.excludeKeywords.includes(c))
  if (learnedTechs.length === 0 && excludeCompanies.length === 0) return profile
  return {
    ...profile,
    technologies: [...profile.technologies, ...learnedTechs],
    excludeKeywords: [...profile.excludeKeywords, ...excludeCompanies],
  }
}

/** Per-technology rank adjustment is clamped so learning nudges, never dominates, the ATS score. */
const MAX_RANK_ADJUSTMENT = 20
const DISLIKED_COMPANY_PENALTY = 30

/**
 * The ranking score used to sort the feed: the deterministic ATS score nudged by learned preferences.
 * Unscored candidates (no matchScore) stay at the bottom.
 */
export function rankScore(candidate: DiscoveredCandidate, prefs: LearnedPreferences): number {
  if (candidate.matchScore === undefined) return -1
  let adjustment = 0
  const techs = candidate.analysis?.detectedStack.map((s) => s.canonical) ?? []
  for (const tech of techs) adjustment += prefs.technologyScores[tech] ?? 0
  adjustment = Math.max(-MAX_RANK_ADJUSTMENT, Math.min(MAX_RANK_ADJUSTMENT, adjustment))
  if (candidate.company && prefs.dislikedCompanies.includes(candidate.company)) {
    adjustment -= DISLIKED_COMPANY_PENALTY
  }
  return candidate.matchScore + adjustment
}
