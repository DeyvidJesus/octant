import { useState } from 'react'
import { CheckCircle2, ChevronDown, ChevronRight, Flag } from 'lucide-react'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { useInterviewPrepStore } from '@/stores/interviewPrepStore'
import type { JobOpportunity } from '@/types/job'
import type { MasterResume } from '@/types/resume'
import type { PrepPriority, PrepQuestion } from '@/types/interviewPrep'
import { CoachPanel } from './CoachPanel'

interface QuestionCardProps {
  question: PrepQuestion
  job: JobOpportunity
  resume: MasterResume
  resumeEvidence: string[]
  missingSkills: string[]
}

const CONFIDENCE_STEPS = [0, 25, 50, 75, 100]

const PRIORITY_LABEL: Record<PrepPriority, string> = {
  'required-missing': 'Gap — required',
  'required-matched': 'Required',
  preferred: 'Preferred',
  'resume-core': 'Core',
}

export function QuestionCard({ question, job, resume, resumeEvidence, missingSkills }: QuestionCardProps) {
  const tracked = useInterviewPrepStore((state) => state.tracked[question.id])
  const rate = useInterviewPrepStore((state) => state.rate)
  const setStatus = useInterviewPrepStore((state) => state.setStatus)
  const toggleMastered = useInterviewPrepStore((state) => state.toggleMastered)

  const [showDetails, setShowDetails] = useState(false)
  const [showCoach, setShowCoach] = useState(false)

  const confidence = tracked?.confidence ?? 0
  const mastered = tracked?.mastered ?? false
  const needsReview = tracked?.status === 'need_review'
  const hasDetails =
    Boolean(question.expectedAnswer) ||
    (question.commonMistakes?.length ?? 0) > 0 ||
    (question.followUps?.length ?? 0) > 0

  return (
    <div className="bg-surface border border-edge rounded-xl p-5 space-y-4">
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm text-ink-2 leading-relaxed">{question.question}</p>
        {mastered && <CheckCircle2 size={18} className="text-emerald-500 shrink-0 mt-0.5" aria-hidden />}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {question.topic && <Badge tone="indigo">{question.topic}</Badge>}
        <Badge>{question.difficulty}</Badge>
        {question.priority !== 'resume-core' && <Badge tone="default">{PRIORITY_LABEL[question.priority]}</Badge>}
      </div>

      {hasDetails && (
        <div>
          <button
            type="button"
            onClick={() => setShowDetails((value) => !value)}
            className="inline-flex items-center gap-1 text-xs text-muted hover:text-ink-2"
          >
            {showDetails ? <ChevronDown size={14} aria-hidden /> : <ChevronRight size={14} aria-hidden />}
            {showDetails ? 'Hide model answer' : 'Show model answer & pitfalls'}
          </button>

          {showDetails && (
            <div className="mt-3 space-y-3 text-sm">
              {question.expectedAnswer && (
                <div>
                  <div className="text-xs text-faint font-semibold uppercase tracking-widest mb-1">Model answer</div>
                  <p className="text-ink-3 leading-relaxed whitespace-pre-wrap">{question.expectedAnswer}</p>
                </div>
              )}
              {question.commonMistakes && question.commonMistakes.length > 0 && (
                <DetailList title="Common mistakes" items={question.commonMistakes} />
              )}
              {question.followUps && question.followUps.length > 0 && (
                <DetailList title="Likely follow-ups" items={question.followUps} />
              )}
            </div>
          )}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3 pt-1">
        <div className="flex items-center gap-2">
          <span className="text-xs text-faint">Confidence</span>
          <div className="flex gap-1">
            {CONFIDENCE_STEPS.map((step) => (
              <button
                key={step}
                type="button"
                onClick={() => rate(question, step)}
                aria-pressed={confidence === step}
                className={`px-2 py-1 rounded text-xs border transition-colors ${
                  confidence === step
                    ? 'border-white bg-white text-black font-medium'
                    : 'border-edge-2 text-muted hover:text-ink-2'
                }`}
              >
                {step}
              </button>
            ))}
          </div>
        </div>

        <Button
          variant={needsReview ? 'accent' : 'ghost'}
          onClick={() => setStatus(question, needsReview ? 'in_progress' : 'need_review')}
        >
          <Flag size={14} aria-hidden />
          {needsReview ? 'Marked for review' : 'Needs review'}
        </Button>

        <Button variant={mastered ? 'accent' : 'subtle'} onClick={() => toggleMastered(question)}>
          <CheckCircle2 size={14} aria-hidden />
          {mastered ? 'Mastered' : 'Mark mastered'}
        </Button>

        <button
          type="button"
          onClick={() => setShowCoach((value) => !value)}
          className="ml-auto text-xs text-muted hover:text-ink-2"
        >
          {showCoach ? 'Hide practice' : 'Practice with AI coach'}
        </button>
      </div>

      {showCoach && (
        <CoachPanel
          job={job}
          resume={resume}
          question={question}
          resumeEvidence={resumeEvidence}
          missingSkills={missingSkills}
        />
      )}
    </div>
  )
}

function DetailList({ title, items }: { title: string; items: string[] }) {
  return (
    <div>
      <div className="text-xs text-faint font-semibold uppercase tracking-widest mb-1">{title}</div>
      <ul className="space-y-1 text-ink-3">
        {items.map((item, index) => (
          <li key={index} className="flex gap-2">
            <span className="text-faint shrink-0" aria-hidden>
              •
            </span>
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
