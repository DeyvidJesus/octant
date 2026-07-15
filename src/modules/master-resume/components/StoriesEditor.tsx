import type { ExperienceEntry, StarStory } from '@/types/resume'
import { Input, Textarea } from '@/components/ui/Input'
import { Field } from '@/components/ui/Field'
import { TagInput } from '@/components/ui/TagInput'
import { createId } from '@/utils/id'
import { EntityList } from './EntityList'

interface StoriesEditorProps {
  stories: StarStory[]
  experiences: ExperienceEntry[]
  onChange: (next: StarStory[]) => void
}

export function StoriesEditor({ stories, experiences, onChange }: StoriesEditorProps) {
  return (
    <EntityList
      items={stories}
      onChange={onChange}
      create={(): StarStory => ({ id: createId(), title: '', situation: '', task: '', action: '', result: '', skills: [], competencies: [], tags: [] })}
      addLabel="Add STAR story"
      emptyHint="No stories yet. STAR stories power behavioral interview prep and can seed resume bullets."
      itemTitle={(item) => item.title || 'New story'}
      renderItem={(item, update) => (
        <div className="space-y-3">
          <Field label="Title">
            <Input value={item.title} onChange={(e) => update({ title: e.target.value })} />
          </Field>
          <Field label="Situation">
            <Textarea rows={2} value={item.situation} onChange={(e) => update({ situation: e.target.value })} />
          </Field>
          <Field label="Task">
            <Textarea rows={2} value={item.task} onChange={(e) => update({ task: e.target.value })} />
          </Field>
          <Field label="Action">
            <Textarea rows={2} value={item.action} onChange={(e) => update({ action: e.target.value })} />
          </Field>
          <Field label="Result">
            <Textarea rows={2} value={item.result} onChange={(e) => update({ result: e.target.value })} />
          </Field>
          <Field label="Related experience (optional)">
            <select
              value={item.experienceId ?? ''}
              onChange={(e) => update({ experienceId: e.target.value || undefined })}
              className="w-full bg-base border border-edge-2 rounded px-3 py-2 text-sm text-ink-2 focus:outline-none focus:border-[#555]"
            >
              <option value="">— none —</option>
              {experiences.map((exp) => (
                <option key={exp.id} value={exp.id}>
                  {[exp.role, exp.company].filter(Boolean).join(' @ ')}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Skills">
            <TagInput ariaLabel="Story skills" values={item.skills} onChange={(skills) => update({ skills })} />
          </Field>
          <Field label="Competencies">
            <TagInput ariaLabel="Competencies" values={item.competencies} onChange={(competencies) => update({ competencies })} />
          </Field>
          <Field label="Tags">
            <TagInput ariaLabel="Tags" values={item.tags} onChange={(tags) => update({ tags })} />
          </Field>
        </div>
      )}
    />
  )
}
