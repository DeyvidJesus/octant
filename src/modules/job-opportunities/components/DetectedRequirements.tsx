import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { SectionLabel } from '@/components/ui/SectionLabel'
import type { DetectedSkill, JobAnalysis } from '@/types/analysis'

const SENIORITY_LABELS: Record<JobAnalysis['detectedSeniority'], string> = {
  junior: 'Junior',
  mid: 'Mid-level',
  senior: 'Senior',
  staff: 'Staff / Principal',
  lead: 'Lead',
  unknown: 'Not specified',
}

export function DetectedRequirements({ analysis }: { analysis: JobAnalysis }) {
  const required = analysis.detectedStack.filter((skill) => skill.importance === 'required')
  const preferred = analysis.detectedStack.filter((skill) => skill.importance === 'preferred')

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
          <div className="space-y-4">
            <SkillGroup title="Must-have" skills={required} />
            <SkillGroup title="Nice-to-have" skills={preferred} />
          </div>
        )}
        <p className="text-xs text-faint mt-4">
          Green = present in your Master Resume · Red = missing. Requirements are separated from
          optional "nice to have" keywords.
        </p>
      </Card>
    </div>
  )
}

function SkillGroup({ title, skills }: { title: string; skills: DetectedSkill[] }) {
  if (skills.length === 0) return null
  return (
    <div>
      <p className="text-xs text-muted mb-2">{title}</p>
      <div className="flex flex-wrap gap-2">
        {skills.map((skill) => (
          <Badge key={skill.canonical} tone={skill.inResume ? 'emerald' : 'red'}>
            {skill.canonical}
            {skill.count > 1 && <span className="ml-1 opacity-60">×{skill.count}</span>}
          </Badge>
        ))}
      </div>
    </div>
  )
}
