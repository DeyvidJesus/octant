import { Star, Trash2, Plus } from 'lucide-react'
import type { Skill } from '@/types/resume'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { IconButton } from '@/components/ui/IconButton'
import { SectionLabel } from '@/components/ui/SectionLabel'
import { createId } from '@/utils/id'
import { removeById, updateById } from '@/utils/collections'

interface SkillsGridProps {
  skills: Skill[]
  onChange: (next: Skill[]) => void
}

export function SkillsGrid({ skills, onChange }: SkillsGridProps) {
  // Preserve first-seen category order for stable grouping.
  const categories = [...new Set(skills.map((s) => s.category))]

  const addSkill = (category: string) =>
    onChange([...skills, { id: createId(), canonical: '', category, proficiency: 3 }])

  return (
    <div className="space-y-6">
      {categories.map((category) => (
        <div key={category}>
          <SectionLabel className="mb-2">{category}</SectionLabel>
          <div className="space-y-2">
            {skills
              .filter((skill) => skill.category === category)
              .map((skill) => (
                <div key={skill.id} className="flex items-center gap-2">
                  <Input
                    aria-label="Skill name"
                    className="flex-1"
                    value={skill.canonical}
                    placeholder="Skill name"
                    onChange={(e) => onChange(updateById(skills, skill.id, { canonical: e.target.value }))}
                  />
                  <ProficiencyPicker
                    value={skill.proficiency ?? 0}
                    onChange={(proficiency) => onChange(updateById(skills, skill.id, { proficiency: proficiency as Skill['proficiency'] }))}
                  />
                  <IconButton
                    icon={Star}
                    label={skill.favorite ? 'Unmark favorite' : 'Mark favorite'}
                    className={skill.favorite ? 'text-amber-400 hover:text-amber-300' : ''}
                    onClick={() => onChange(updateById(skills, skill.id, { favorite: !skill.favorite }))}
                  />
                  <IconButton icon={Trash2} label="Delete skill" tone="danger" onClick={() => onChange(removeById(skills, skill.id))} />
                </div>
              ))}
          </div>
          <button
            type="button"
            onClick={() => addSkill(category)}
            className="mt-2 text-xs text-muted hover:text-ink-2 inline-flex items-center gap-1"
          >
            <Plus size={12} aria-hidden /> Add to {category}
          </button>
        </div>
      ))}

      <NewCategory onAdd={(category) => addSkill(category)} />
    </div>
  )
}

function ProficiencyPicker({ value, onChange }: { value: number; onChange: (value: number) => void }) {
  return (
    <div className="flex gap-1" role="group" aria-label="Proficiency">
      {[1, 2, 3, 4, 5].map((level) => (
        <button
          key={level}
          type="button"
          aria-label={`Set proficiency ${level} of 5`}
          onClick={() => onChange(level)}
          className={`w-3.5 h-3.5 rounded-full transition-colors ${level <= value ? 'bg-white' : 'bg-edge hover:bg-edge-2'}`}
        />
      ))}
    </div>
  )
}

function NewCategory({ onAdd }: { onAdd: (category: string) => void }) {
  return (
    <Button
      variant="subtle"
      onClick={() => {
        const name = window.prompt('New skill category name (e.g. "DevOps")')?.trim()
        if (name) onAdd(name)
      }}
    >
      <Plus size={14} aria-hidden /> Add category
    </Button>
  )
}
