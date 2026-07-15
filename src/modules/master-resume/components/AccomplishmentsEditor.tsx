import type { Accomplishment } from '@/types/resume'
import { Input, Textarea } from '@/components/ui/Input'
import { Field } from '@/components/ui/Field'
import { TagInput } from '@/components/ui/TagInput'
import { createId } from '@/utils/id'
import { EntityList } from './EntityList'

interface AccomplishmentsEditorProps {
  accomplishments: Accomplishment[]
  onChange: (next: Accomplishment[]) => void
}

export function AccomplishmentsEditor({ accomplishments, onChange }: AccomplishmentsEditorProps) {
  return (
    <Field label="Accomplishments">
      <EntityList
        items={accomplishments}
        onChange={onChange}
        create={(): Accomplishment => ({ id: createId(), text: '', skills: [], keywords: [] })}
        addLabel="Add accomplishment"
        emptyHint="No accomplishments yet. Each is a reusable, tagged achievement."
        itemTitle={(item) => item.text || 'New accomplishment'}
        renderItem={(item, update) => (
          <div className="space-y-3">
            <Textarea
              aria-label="Accomplishment text"
              rows={2}
              value={item.text}
              placeholder="Action + technology + measurable impact"
              onChange={(event) => update({ text: event.target.value })}
            />
            <Field label="Metric (optional)">
              <Input
                value={item.metric ?? ''}
                placeholder="e.g. improved LCP 40%"
                onChange={(event) => update({ metric: event.target.value || undefined })}
              />
            </Field>
            <Field label="Skills demonstrated">
              <TagInput
                ariaLabel="Skills demonstrated"
                values={item.skills}
                onChange={(skills) => update({ skills, keywords: skills })}
              />
            </Field>
          </div>
        )}
      />
    </Field>
  )
}
