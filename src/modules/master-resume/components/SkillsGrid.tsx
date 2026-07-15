import { Badge } from '@/components/ui/Badge'
import { SectionLabel } from '@/components/ui/SectionLabel'
import type { SkillCategory } from '@/types/resume'

export function SkillsGrid({ skills }: { skills: SkillCategory[] }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {skills.map((category) => (
        <div key={category.id}>
          <SectionLabel className="mb-2">{category.label}</SectionLabel>
          <div className="flex flex-wrap gap-2">
            {category.skills.map((skill) => (
              <Badge key={skill}>{skill}</Badge>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
