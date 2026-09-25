import { Badge } from '@/components/ui/Badge'
import { SectionLabel } from '@/components/ui/SectionLabel'
import type { CoverageReport } from '@/services/generator/coverage'

/** Live ATS keyword coverage of the tailored resume, recomputed on every toggle. */
export function CoverageMeter({ coverage }: { coverage: CoverageReport }) {
  const tone = coverage.score >= 75 ? 'text-success' : coverage.score >= 45 ? 'text-warning' : 'text-danger'

  return (
    <div>
      <div className="flex items-baseline gap-2 mb-1">
        <span className={`text-4xl font-light ${tone}`}>{coverage.score}%</span>
      </div>
      <SectionLabel className="mb-4">Keyword coverage of this document</SectionLabel>

      {coverage.missing.length > 0 && (
        <div className="mb-3">
          <p className="text-xs text-faint mb-1.5">Not covered by included content:</p>
          <div className="flex flex-wrap gap-1.5">
            {coverage.missing.map((skill) => (
              <Badge key={skill} tone="danger">
                {skill}
              </Badge>
            ))}
          </div>
        </div>
      )}

      {coverage.covered.length > 0 && (
        <div>
          <p className="text-xs text-faint mb-1.5">Covered:</p>
          <div className="flex flex-wrap gap-1.5">
            {coverage.covered.map((skill) => (
              <Badge key={skill} tone="success">
                {skill}
              </Badge>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
