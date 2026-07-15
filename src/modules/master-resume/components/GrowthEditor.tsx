import type { LearningEntry, Publication, PortfolioAsset, PortfolioAssetType } from '@/types/resume'
import { Input, Textarea } from '@/components/ui/Input'
import { Field } from '@/components/ui/Field'
import { TagInput } from '@/components/ui/TagInput'
import { createId } from '@/utils/id'
import { EntityList } from './EntityList'

export function PublicationsEditor({
  publications,
  onChange,
}: {
  publications: Publication[]
  onChange: (next: Publication[]) => void
}) {
  return (
    <EntityList
      items={publications}
      onChange={onChange}
      create={(): Publication => ({ id: createId(), title: '', venue: '' })}
      addLabel="Add publication"
      emptyHint="No publications yet."
      itemTitle={(item) => item.title || 'New publication'}
      renderItem={(item, update) => (
        <div className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="Title">
              <Input value={item.title} onChange={(e) => update({ title: e.target.value })} />
            </Field>
            <Field label="Venue">
              <Input value={item.venue} onChange={(e) => update({ venue: e.target.value })} />
            </Field>
            <Field label="Date (optional)">
              <Input value={item.date ?? ''} onChange={(e) => update({ date: e.target.value || undefined })} />
            </Field>
            <Field label="URL (optional)">
              <Input value={item.url ?? ''} onChange={(e) => update({ url: e.target.value || undefined })} />
            </Field>
          </div>
          <Field label="Description (optional)">
            <Textarea rows={2} value={item.description ?? ''} onChange={(e) => update({ description: e.target.value || undefined })} />
          </Field>
        </div>
      )}
    />
  )
}

export function LearningEditor({
  learning,
  onChange,
}: {
  learning: LearningEntry[]
  onChange: (next: LearningEntry[]) => void
}) {
  return (
    <EntityList
      items={learning}
      onChange={onChange}
      create={(): LearningEntry => ({ id: createId(), title: '', provider: '', skills: [] })}
      addLabel="Add learning entry"
      emptyHint="No learning history yet. Track courses, books, and study for learning-ROI insight later."
      itemTitle={(item) => item.title || 'New learning entry'}
      renderItem={(item, update) => (
        <div className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="Title">
              <Input value={item.title} onChange={(e) => update({ title: e.target.value })} />
            </Field>
            <Field label="Provider">
              <Input value={item.provider} onChange={(e) => update({ provider: e.target.value })} />
            </Field>
            <Field label="Completed (optional)">
              <Input value={item.completedAt ?? ''} onChange={(e) => update({ completedAt: e.target.value || undefined })} />
            </Field>
            <Field label="URL (optional)">
              <Input value={item.url ?? ''} onChange={(e) => update({ url: e.target.value || undefined })} />
            </Field>
          </div>
          <Field label="Skills learned">
            <TagInput ariaLabel="Skills learned" values={item.skills} onChange={(skills) => update({ skills })} />
          </Field>
          <Field label="Notes (optional)">
            <Textarea rows={2} value={item.notes ?? ''} onChange={(e) => update({ notes: e.target.value || undefined })} />
          </Field>
        </div>
      )}
    />
  )
}

const PORTFOLIO_TYPES: PortfolioAssetType[] = ['repo', 'live', 'writeup', 'talk', 'other']

export function PortfolioEditor({
  portfolio,
  onChange,
}: {
  portfolio: PortfolioAsset[]
  onChange: (next: PortfolioAsset[]) => void
}) {
  return (
    <EntityList
      items={portfolio}
      onChange={onChange}
      create={(): PortfolioAsset => ({ id: createId(), title: '', type: 'repo', url: '', tags: [] })}
      addLabel="Add portfolio asset"
      emptyHint="No portfolio assets yet."
      itemTitle={(item) => item.title || 'New asset'}
      renderItem={(item, update) => (
        <div className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="Title">
              <Input value={item.title} onChange={(e) => update({ title: e.target.value })} />
            </Field>
            <Field label="Type">
              <select
                value={item.type}
                onChange={(e) => update({ type: e.target.value as PortfolioAssetType })}
                className="w-full bg-base border border-edge-2 rounded px-3 py-2 text-sm text-ink-2 focus:outline-none focus:border-[#555] capitalize"
              >
                {PORTFOLIO_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
            </Field>
          </div>
          <Field label="URL">
            <Input value={item.url} onChange={(e) => update({ url: e.target.value })} />
          </Field>
          <Field label="Description (optional)">
            <Textarea rows={2} value={item.description ?? ''} onChange={(e) => update({ description: e.target.value || undefined })} />
          </Field>
          <Field label="Tags">
            <TagInput ariaLabel="Asset tags" values={item.tags} onChange={(tags) => update({ tags })} />
          </Field>
        </div>
      )}
    />
  )
}
