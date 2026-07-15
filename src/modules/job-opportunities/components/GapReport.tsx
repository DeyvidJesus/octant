import { AlertCircle, CheckCircle2 } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import type { JobAnalysis } from '@/types/analysis'

export function GapReport({ analysis }: { analysis: JobAnalysis }) {
  const { matched, missing } = analysis.match

  return (
    <div className="space-y-6">
      <Card className="border-red-900/30 bg-red-900/5">
        <h3 className="text-sm font-medium text-red-400 mb-4 flex items-center gap-2">
          <AlertCircle size={16} aria-hidden /> Missing Keywords / ATS Risks
        </h3>
        {missing.length === 0 ? (
          <p className="text-sm text-ink-2">No gaps detected — every recognized keyword in this job description exists in your Master Resume.</p>
        ) : (
          <ul className="space-y-2">
            {missing.map((skill) => (
              <li key={skill} className="text-sm text-ink-2 flex gap-2">
                <span className="text-red-500/50" aria-hidden>
                  -
                </span>
                {skill} — not found in your Master Resume. Add it only if you genuinely have the experience.
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card className="border-emerald-900/30 bg-emerald-900/5">
        <h3 className="text-sm font-medium text-emerald-400 mb-4 flex items-center gap-2">
          <CheckCircle2 size={16} aria-hidden /> Confirmed Strengths
        </h3>
        {matched.length === 0 ? (
          <p className="text-sm text-ink-2">No overlapping keywords detected yet.</p>
        ) : (
          <ul className="space-y-2">
            {matched.map((skill) => (
              <li key={skill} className="text-sm text-ink-2 flex gap-2">
                <span className="text-emerald-500/50" aria-hidden>
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
