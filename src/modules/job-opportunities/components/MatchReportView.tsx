import { Card } from '@/components/ui/Card'
import { ScoreBar } from '@/components/ui/ScoreBar'
import { SectionLabel } from '@/components/ui/SectionLabel'
import type { MatchReport } from '@/types/analysis'

export function MatchReportView({ match }: { match: MatchReport }) {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
        <Card className="flex flex-col items-center justify-center py-10">
          <div className="text-6xl font-light text-white mb-2">
            {match.atsScore}
            <span className="text-2xl text-faint">%</span>
          </div>
          <SectionLabel>ATS Keyword Coverage</SectionLabel>
        </Card>
        <Card className="flex flex-col justify-center space-y-4">
          {match.categoryBreakdown.length === 0 ? (
            <p className="text-sm text-muted">No categories detected in this job description.</p>
          ) : (
            match.categoryBreakdown.map((category) => (
              <ScoreBar key={category.category} label={category.category} score={category.score} max={5} />
            ))
          )}
        </Card>
      </div>

      <Card>
        <h3 className="text-sm font-medium text-white mb-2">Observations</h3>
        <ul className="space-y-2">
          {match.notes.map((note, i) => (
            <li key={i} className="text-ink-3 text-sm leading-relaxed">
              {note}
            </li>
          ))}
        </ul>
      </Card>
    </div>
  )
}
