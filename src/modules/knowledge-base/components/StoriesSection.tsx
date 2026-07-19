import type { FactStatus, KnowledgeStory } from '@/types/resume'
import { Badge } from '@/components/ui/Badge'
import { Field } from '@/components/ui/Field'
import { Input } from '@/components/ui/Input'
import { TagInput } from '@/components/ui/TagInput'
import { createId } from '@/utils/id'
import { FACT_STATUS_LABELS, FACT_STATUS_TONES } from '@/constants/knowledge'
import { storyText } from '@/services/knowledge/search'
import { KnowledgeList } from './KnowledgeList'
import { StatusSelect } from './StatusSelect'

function emptyStory(): KnowledgeStory {
  return {
    id: createId(),
    title: '',
    situationFactIds: [],
    taskFactIds: [],
    actionFactIds: [],
    resultFactIds: [],
    skillIds: [],
    competencies: [],
    roleIds: [],
    tags: [],
    status: 'todo',
    provenance: { source: 'manual', excerpt: '' },
  }
}

interface StoriesSectionProps {
  stories: KnowledgeStory[]
  onChange: (next: KnowledgeStory[]) => void
  query: string
  statusFilter: 'all' | FactStatus
}

export function StoriesSection({ stories, onChange, query, statusFilter }: StoriesSectionProps) {
  return (
    <KnowledgeList
      items={stories}
      onChange={onChange}
      create={emptyStory}
      addLabel="Add story"
      emptyHint="No STAR stories yet. Link situation, task, action, and result facts into reusable behavioural interview stories."
      isVisible={(s) => {
        if (statusFilter !== 'all' && s.status !== statusFilter) return false
        return storyText(s).toLocaleLowerCase().includes(query.trim().toLocaleLowerCase())
      }}
      itemTitle={(s) => (
        <span className="flex items-center gap-2">
          <Badge tone={FACT_STATUS_TONES[s.status]}>{FACT_STATUS_LABELS[s.status]}</Badge>
          {s.title || 'Untitled story'}
        </span>
      )}
      renderItem={(story, update) => (
        <div className="space-y-3">
          <Field label="Title">
            <Input value={story.title} onChange={(e) => update({ title: e.target.value })} />
          </Field>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="Competencies">
              <TagInput
                ariaLabel="Competencies"
                values={story.competencies}
                onChange={(competencies) => update({ competencies })}
              />
            </Field>
            <Field label="Tags">
              <TagInput ariaLabel="Story tags" values={story.tags} onChange={(tags) => update({ tags })} />
            </Field>
          </div>
          <Field label="Status">
            <StatusSelect value={story.status} onChange={(status) => update({ status })} />
          </Field>
        </div>
      )}
    />
  )
}
