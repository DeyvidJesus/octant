import type { Application, ApplicationStage } from '@/types/application'

/**
 * Deterministic, framework-free career analytics derived from tracked
 * applications and their timestamped stage-change events. All functions are
 * pure so they are unit-testable without the store.
 */

/** Ordered active pipeline stages that form the funnel (terminal stages excluded). */
export const FUNNEL_STAGES: ApplicationStage[] = [
  'saved',
  'applied',
  'screening',
  'interviewing',
  'technical',
  'offer',
]

const FUNNEL_INDEX: Record<string, number> = Object.fromEntries(FUNNEL_STAGES.map((s, i) => [s, i]))

const DAY_MS = 24 * 60 * 60 * 1000

export interface FunnelStep {
  stage: ApplicationStage
  /** Applications that reached this stage or further. */
  count: number
  /** Conversion from the previous step (0-100); 100 for the first step. */
  conversion: number
}

/**
 * Terminal stages imply a minimum funnel progress even without recorded
 * history: `accepted` implies an offer; `rejected`/`ghosted` imply the app was
 * at least applied. `withdrawn` is ambiguous (you can withdraw a saved one), so
 * it relies on recorded history only.
 */
const TERMINAL_IMPLIED: Partial<Record<ApplicationStage, ApplicationStage>> = {
  accepted: 'offer',
  rejected: 'applied',
  ghosted: 'applied',
}

/**
 * The furthest funnel index an application reached, inferred from its stage
 * history (stage-change events + current stage) and terminal-stage implications.
 */
export function furthestFunnelIndex(app: Application): number {
  let max = -1
  const consider = (stage?: ApplicationStage) => {
    if (!stage) return
    const mapped = TERMINAL_IMPLIED[stage] ?? stage
    const index = FUNNEL_INDEX[mapped]
    if (index !== undefined && index > max) max = index
  }
  consider(app.stage)
  for (const event of app.events) {
    if (event.kind === 'stage_change') {
      consider(event.fromStage)
      consider(event.toStage)
    }
  }
  return max
}

/** Counts per funnel stage (apps that reached each stage) with conversion rates. */
export function funnel(applications: Application[]): FunnelStep[] {
  const reached = applications.map(furthestFunnelIndex)
  const counts = FUNNEL_STAGES.map((_, index) => reached.filter((r) => r >= index).length)
  return FUNNEL_STAGES.map((stage, index) => ({
    stage,
    count: counts[index],
    conversion: index === 0 ? 100 : counts[index - 1] === 0 ? 0 : (counts[index] / counts[index - 1]) * 100,
  }))
}

export interface OutcomeBreakdown {
  offer: number
  rejected: number
  ghosted: number
  withdrawn: number
  active: number
}

/** Buckets every application into a single mutually-exclusive outcome. */
export function outcomes(applications: Application[]): OutcomeBreakdown {
  const result: OutcomeBreakdown = { offer: 0, rejected: 0, ghosted: 0, withdrawn: 0, active: 0 }
  for (const app of applications) {
    switch (app.stage) {
      case 'offer':
      case 'accepted':
        result.offer += 1
        break
      case 'rejected':
        result.rejected += 1
        break
      case 'ghosted':
        result.ghosted += 1
        break
      case 'withdrawn':
        result.withdrawn += 1
        break
      default:
        result.active += 1
    }
  }
  return result
}

export interface RateSummary {
  total: number
  /** % of applications that got any response beyond the initial submission. */
  responseRate: number
  /** % of applications that reached an offer/accepted. */
  offerRate: number
  /** % of applications that were ghosted. */
  ghostRate: number
}

/**
 * A submitted application "got a response" if it progressed past `applied`
 * (reached screening or beyond) or ended rejected. Saved-but-never-applied
 * entries are excluded from the denominator.
 */
export function rates(applications: Application[]): RateSummary {
  const submitted = applications.filter((app) => furthestFunnelIndex(app) >= FUNNEL_INDEX.applied)
  const total = submitted.length
  if (total === 0) return { total: 0, responseRate: 0, offerRate: 0, ghostRate: 0 }

  const responded = submitted.filter(
    (app) => furthestFunnelIndex(app) >= FUNNEL_INDEX.screening || app.stage === 'rejected',
  ).length
  const offers = submitted.filter((app) => app.stage === 'offer' || app.stage === 'accepted').length
  const ghosted = submitted.filter((app) => app.stage === 'ghosted').length

  return {
    total,
    responseRate: (responded / total) * 100,
    offerRate: (offers / total) * 100,
    ghostRate: (ghosted / total) * 100,
  }
}

export interface StageDuration {
  stage: ApplicationStage
  /** Average days spent in this stage before moving on. */
  avgDays: number
  samples: number
}

/**
 * Average time spent in each stage, measured between consecutive stage-change
 * events. The duration is attributed to the stage being left (`fromStage`).
 */
export function timeInStage(applications: Application[]): StageDuration[] {
  const totals = new Map<ApplicationStage, { days: number; samples: number }>()

  for (const app of applications) {
    const changes = app.events
      .filter((e) => e.kind === 'stage_change')
      .sort((a, b) => a.at.localeCompare(b.at))
    for (let i = 1; i < changes.length; i += 1) {
      const from = changes[i].fromStage
      if (!from) continue
      const days = (Date.parse(changes[i].at) - Date.parse(changes[i - 1].at)) / DAY_MS
      if (!Number.isFinite(days) || days < 0) continue
      const entry = totals.get(from) ?? { days: 0, samples: 0 }
      entry.days += days
      entry.samples += 1
      totals.set(from, entry)
    }
  }

  return FUNNEL_STAGES.filter((stage) => totals.has(stage)).map((stage) => {
    const entry = totals.get(stage)!
    return { stage, avgDays: entry.days / entry.samples, samples: entry.samples }
  })
}

/** Average days from creation to reaching an offer, across apps that got one. */
export function averageTimeToOffer(applications: Application[]): number | null {
  const durations: number[] = []
  for (const app of applications) {
    const offerEvent = app.events.find((e) => e.kind === 'stage_change' && e.toStage === 'offer')
    if (!offerEvent) continue
    const days = (Date.parse(offerEvent.at) - Date.parse(app.createdAt)) / DAY_MS
    if (Number.isFinite(days) && days >= 0) durations.push(days)
  }
  if (durations.length === 0) return null
  return durations.reduce((sum, d) => sum + d, 0) / durations.length
}

export interface WeeklyActivity {
  /** ISO date of the week's Monday (UTC). */
  weekStart: string
  count: number
}

/** Applications created per ISO week (Monday-anchored, UTC), sorted ascending. */
export function activityByWeek(applications: Application[]): WeeklyActivity[] {
  const buckets = new Map<string, number>()
  for (const app of applications) {
    const week = mondayOf(app.createdAt)
    if (!week) continue
    buckets.set(week, (buckets.get(week) ?? 0) + 1)
  }
  return [...buckets.entries()]
    .map(([weekStart, count]) => ({ weekStart, count }))
    .sort((a, b) => a.weekStart.localeCompare(b.weekStart))
}

function mondayOf(iso: string): string | null {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return null
  const day = date.getUTCDay() // 0 Sun … 6 Sat
  const diff = (day + 6) % 7 // days since Monday
  const monday = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate() - diff))
  return monday.toISOString().slice(0, 10)
}

export interface MatchScoreBucket {
  label: string
  count: number
}

const MATCH_BUCKETS: { label: string; min: number; max: number }[] = [
  { label: '0–19', min: 0, max: 20 },
  { label: '20–39', min: 20, max: 40 },
  { label: '40–59', min: 40, max: 60 },
  { label: '60–79', min: 60, max: 80 },
  { label: '80–100', min: 80, max: 101 },
]

/** Histogram of application match scores across the fixed buckets. */
export function matchScoreDistribution(applications: Application[]): MatchScoreBucket[] {
  const scores = applications
    .map((app) => app.matchScore)
    .filter((score): score is number => typeof score === 'number')
  return MATCH_BUCKETS.map(({ label, min, max }) => ({
    label,
    count: scores.filter((score) => score >= min && score < max).length,
  }))
}

/** Mean match score across applications that have one, or null. */
export function averageMatchScore(applications: Application[]): number | null {
  const scores = applications
    .map((app) => app.matchScore)
    .filter((score): score is number => typeof score === 'number')
  if (scores.length === 0) return null
  return scores.reduce((sum, score) => sum + score, 0) / scores.length
}
