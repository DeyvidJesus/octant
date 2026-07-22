import { useMemo, useState } from 'react'
import { AlertTriangle, ShieldCheck, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { SectionLabel } from '@/components/ui/SectionLabel'
import { resolveAiRunConfig } from '@/stores/settingsStore'
import { getProviderDescriptor } from '@/services/ai/registry'
import { interviewCoach, type InterviewCoachResult } from '@/services/ai/tasks/interviewCoach'
import { useInterviewPrepStore } from '@/stores/interviewPrepStore'
import { skillKeyFor } from '@/services/interviewPrep/mastery'
import type { JobOpportunity } from '@/types/job'
import type { MasterResume } from '@/types/resume'
import type { PrepQuestion } from '@/types/interviewPrep'

interface CoachPanelProps {
  job: JobOpportunity
  resume: MasterResume
  question: PrepQuestion
  resumeEvidence: string[]
  missingSkills: string[]
  /** Ties this panel to the disclosure button that toggles it (aria-controls). */
  panelId?: string
}

export function CoachPanel({ job, resume, question, resumeEvidence, missingSkills, panelId }: CoachPanelProps) {
  const config = useMemo(() => resolveAiRunConfig(), [])

  const recordAnswer = useInterviewPrepStore((state) => state.recordAnswer)
  const [answer, setAnswer] = useState('')
  const [result, setResult] = useState<InterviewCoachResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [masteryNote, setMasteryNote] = useState<string | null>(null)

  const run = async () => {
    if (!answer.trim()) return
    setLoading(true)
    setError(null)
    try {
      const coachResult = await interviewCoach(
        {
          job,
          question: question.question,
          userAnswer: answer,
          expectedAnswer: question.expectedAnswer ?? '',
          resume,
          resumeEvidence,
          missingSkills,
        },
        config,
      )
      setResult(coachResult)
      // Closed loop: persist the answer and blend its AI score into the skill's mastery.
      const updated = await recordAnswer({
        job: { id: job.id, company: job.company, role: job.role },
        skill: skillKeyFor(question.topic, question.category),
        category: question.category,
        question: question.question,
        answer,
        score: coachResult.score,
        feedback: coachResult,
      })
      if (updated) setMasteryNote(`${updated.skill} mastery is now ${updated.mastery}% (${updated.attempts} attempt${updated.attempts === 1 ? '' : 's'}).`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Coaching failed.')
    } finally {
      setLoading(false)
    }
  }

  const providerLabel = getProviderDescriptor(config.providerId)?.label ?? config.providerId

  return (
    <div id={panelId} className="rounded-lg border border-edge bg-base/40 p-4 space-y-3">
      <div className="flex items-center justify-between gap-3">
        <SectionLabel>Practice answer</SectionLabel>
        <Button onClick={run} disabled={loading || !answer.trim()}>
          <Sparkles size={14} aria-hidden />
          {loading ? 'Coaching…' : result ? 'Re-grade' : 'Coach me'}
        </Button>
      </div>

      <textarea
        value={answer}
        onChange={(event) => setAnswer(event.target.value)}
        rows={4}
        placeholder="Type how you would answer this question out loud…"
        className="w-full rounded-lg border border-edge bg-surface px-3 py-2 text-sm text-ink-2 placeholder:text-faint focus:outline-none focus-visible:border-edge-2"
      />

      {error && (
        <p className="text-sm text-red-400" role="alert">
          {error}
        </p>
      )}

      {result && <CoachFeedback result={result} providerLabel={providerLabel} />}
      {masteryNote && <p className="text-xs text-emerald-400">{masteryNote}</p>}
    </div>
  )
}

function CoachFeedback({ result, providerLabel }: { result: InterviewCoachResult; providerLabel: string }) {
  return (
    <div className="space-y-3 pt-1">
      <GroundingBanner result={result} />

      <div className="flex items-center gap-3">
        <span className="text-2xl font-semibold text-white">{result.score}</span>
        <span className="text-xs text-faint">/ 100</span>
        <span className="text-sm text-ink-2">{result.verdict}</span>
      </div>

      {result.strengths.length > 0 && (
        <FeedbackList title="Strengths" items={result.strengths} tone="emerald" />
      )}
      {result.gaps.length > 0 && <FeedbackList title="Gaps" items={result.gaps} tone="red" />}

      {result.idealAnswer && (
        <div>
          <SectionLabel>Stronger answer</SectionLabel>
          <p className="text-sm text-ink-2 leading-relaxed whitespace-pre-wrap mt-1">{result.idealAnswer}</p>
        </div>
      )}

      {result.hardFollowUps.length > 0 && (
        <FeedbackList title="Hard follow-ups to expect" items={result.hardFollowUps} />
      )}

      {result.nextStudyAction && (
        <p className="text-sm text-ink-3">
          <span className="text-faint">Next: </span>
          {result.nextStudyAction}
        </p>
      )}

      <p className="text-xs text-faint pt-2 border-t border-edge">
        Graded by {providerLabel} · {result.model}
      </p>
    </div>
  )
}

function FeedbackList({ title, items, tone }: { title: string; items: string[]; tone?: 'emerald' | 'red' }) {
  const marker = tone === 'emerald' ? 'text-emerald-400' : tone === 'red' ? 'text-red-400' : 'text-faint'
  return (
    <div>
      <SectionLabel>{title}</SectionLabel>
      <ul className="mt-1 space-y-1 text-sm text-ink-2">
        {items.map((item, index) => (
          <li key={index} className="flex gap-2">
            <span className={`${marker} shrink-0`} aria-hidden>
              •
            </span>
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

function GroundingBanner({ result }: { result: InterviewCoachResult }) {
  if (result.grounding.ok) {
    return (
      <div className="flex items-center gap-2 text-xs text-emerald-400">
        <ShieldCheck size={14} aria-hidden />
        Grounded — feedback traces only to your Master Resume and this job.
      </div>
    )
  }

  return (
    <div className="flex items-start gap-2 rounded-lg border border-red-800/50 bg-red-900/20 p-3">
      <AlertTriangle size={16} className="text-red-300 shrink-0 mt-0.5" aria-hidden />
      <div className="text-xs text-red-200 leading-relaxed">
        <strong>Unverified mentions:</strong>{' '}
        {result.grounding.unverifiedSkills.map((skill, index) => (
          <span key={skill}>
            {index > 0 && ', '}
            <Badge tone="red" className="mx-0.5">
              {skill}
            </Badge>
          </span>
        ))}
        <div className="mt-1.5 text-red-300/80">
          These appear in neither your Master Resume nor this job. Treat as unverified.
        </div>
      </div>
    </div>
  )
}
