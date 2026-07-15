import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { SectionLabel } from '@/components/ui/SectionLabel'
import type { JobAnalysis } from '@/types/analysis'
import { SKILL_CATEGORY_LABELS, type SkillTaxonomyCategory } from '@/constants/skillTaxonomy'

const SENIORITY_LABELS: Record<JobAnalysis['detectedSeniority'], string> = {
  junior: 'Junior',
  mid: 'Mid-level',
  senior: 'Senior',
  staff: 'Staff / Principal',
  lead: 'Lead',
  unknown: 'Not specified',
}

export function DetectedRequirements({ analysis }: { analysis: JobAnalysis }) {
  return (
    <div className="space-y-6">
      <Card>
        <SectionLabel className="mb-3">Detected Seniority</SectionLabel>
        <p className="text-xl text-white font-medium mb-2">
          {SENIORITY_LABELS[analysis.detectedSeniority]}
        </p>
        {analysis.seniorityEvidence.length > 0 && (
          <p className="text-xs text-muted">
            Evidence from the job description: {analysis.seniorityEvidence.join(', ')}
          </p>
        )}
      </Card>

      <Card>
        <SectionLabel className="mb-3">Detected Stack & Keywords</SectionLabel>
        {analysis.detectedStack.length === 0 ? (
          <p className="text-sm text-muted">
            No known technologies detected — paste a fuller job description for better results.
          </p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {analysis.detectedStack.map((skill) => (
              <Badge key={skill.canonical} tone={skill.inResume ? 'emerald' : 'red'}>
                {skill.canonical}
                {skill.count > 1 && <span className="ml-1 opacity-60">×{skill.count}</span>}
              </Badge>
            ))}
          </div>
        )}
        <p className="text-xs text-faint mt-4">
          Green = present in your Master Resume · Red = missing ·{' '}
          {(Object.keys(SKILL_CATEGORY_LABELS) as SkillTaxonomyCategory[]).length} categories scanned
        </p>
      </Card>
    </div>
  )
}
