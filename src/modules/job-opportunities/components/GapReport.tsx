import { AlertCircle, CheckCircle2, MinusCircle } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import type { JobAnalysis } from '@/types/analysis'

export function GapReport({ analysis }: { analysis: JobAnalysis }) {
  const { matched } = analysis.match
  const missing = analysis.detectedStack.filter((skill) => !skill.inResume)
  const missingMustHaves = missing.filter((skill) => skill.importance === 'required')
  const missingNiceToHaves = missing.filter((skill) => skill.importance === 'preferred')

  return (
    <div className="space-y-6">
      <Card className="border-danger-deep/30 bg-danger-deep/5">
        <h3 className="text-sm font-medium text-danger mb-4 flex items-center gap-2">
          <AlertCircle size={16} aria-hidden /> Missing Must-Haves
        </h3>
        {missingMustHaves.length === 0 ? (
          <p className="text-sm text-ink-2">
            No hard-requirement gaps — every skill this posting requires exists in your Master Resume.
          </p>
        ) : (
          <ul className="space-y-2">
            {missingMustHaves.map((skill) => (
              <li key={skill.canonical} className="text-sm text-ink-2 flex gap-2">
                <span className="text-danger-strong/50" aria-hidden>
                  -
                </span>
                {skill.canonical} — required and not found in your Master Resume. Add it only if you
                genuinely have the experience.
              </li>
            ))}
          </ul>
        )}
      </Card>

      {missingNiceToHaves.length > 0 && (
        <Card>
          <h3 className="text-sm font-medium text-muted mb-4 flex items-center gap-2">
            <MinusCircle size={16} aria-hidden /> Missing Nice-to-Haves
          </h3>
          <ul className="space-y-2">
            {missingNiceToHaves.map((skill) => (
              <li key={skill.canonical} className="text-sm text-ink-3 flex gap-2">
                <span className="text-faint" aria-hidden>
                  -
                </span>
                {skill.canonical} — optional in this posting, so a lower-priority gap.
              </li>
            ))}
          </ul>
        </Card>
      )}

      <Card className="border-success-deep/30 bg-success-deep/5">
        <h3 className="text-sm font-medium text-success mb-4 flex items-center gap-2">
          <CheckCircle2 size={16} aria-hidden /> Confirmed Strengths
        </h3>
        {matched.length === 0 ? (
          <p className="text-sm text-ink-2">No overlapping keywords detected yet.</p>
        ) : (
          <ul className="space-y-2">
            {matched.map((skill) => (
              <li key={skill} className="text-sm text-ink-2 flex gap-2">
                <span className="text-success-strong/50" aria-hidden>
                  +
                </span>
                {skill} — emphasize this when tailoring your resume for this role.
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  )
}
