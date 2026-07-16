import { Badge } from '@/components/ui/Badge'
import { SectionLabel } from '@/components/ui/SectionLabel'
import type { CoverageReport } from '@/services/generator/coverage'

/**
 * Live ATS coverage of the tailored document. Recomputed on every toggle so
 * trimming a bullet immediately shows its keyword cost — the resume equivalent
 * of a build status.
 */
export function CoverageMeter({ coverage }: { coverage: CoverageReport }) {
  const tone = coverage.score >= 75 ? 'text-emerald-400' : coverage.score >= 45 ? 'text-amber-400' : 'text-red-400'

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
              <Badge key={skill} tone="red">
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
              <Badge key={skill} tone="emerald">
                {skill}
              </Badge>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
