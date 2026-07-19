import type { FactStatus, KnowledgePortfolioAsset, PortfolioAssetType } from '@/types/resume'
import { Badge } from '@/components/ui/Badge'
import { Field } from '@/components/ui/Field'
import { Input, Textarea } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { TagInput } from '@/components/ui/TagInput'
import { createId } from '@/utils/id'
import { FACT_STATUS_LABELS, FACT_STATUS_TONES } from '@/constants/knowledge'
import { KnowledgeList } from './KnowledgeList'
import { StatusSelect } from './StatusSelect'

const ASSET_TYPES: PortfolioAssetType[] = ['repo', 'live', 'writeup', 'talk', 'other']

function emptyAsset(): KnowledgePortfolioAsset {
  return {
    id: createId(),
    title: '',
    type: 'repo',
    initiativeIds: [],
    tags: [],
    status: 'todo',
    provenance: { source: 'manual', excerpt: '' },
  }
}

interface PortfolioSectionProps {
  portfolioAssets: KnowledgePortfolioAsset[]
  onChange: (next: KnowledgePortfolioAsset[]) => void
  query: string
  statusFilter: 'all' | FactStatus
}

/** Repos, live demos, write-ups, and talks that back up your work. */
export function PortfolioSection({ portfolioAssets, onChange, query, statusFilter }: PortfolioSectionProps) {
  return (
    <KnowledgeList
      items={portfolioAssets}
      onChange={onChange}
      create={emptyAsset}
      addLabel="Add portfolio asset"
      emptyHint="No portfolio assets yet. Add repos, live demos, write-ups, or talks."
      isVisible={(asset) => {
        if (statusFilter !== 'all' && asset.status !== statusFilter) return false
        return `${asset.title} ${asset.description ?? ''}`.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase())
      }}
      itemTitle={(asset) => (
        <span className="flex items-center gap-2">
          <Badge tone={FACT_STATUS_TONES[asset.status]}>{FACT_STATUS_LABELS[asset.status]}</Badge>
          {asset.title || 'Untitled asset'}
          <span className="text-faint">· {asset.type}</span>
        </span>
      )}
      renderItem={(asset, update) => (
        <div className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Field label="Title">
              <Input value={asset.title} onChange={(e) => update({ title: e.target.value })} />
            </Field>
            <Field label="Type">
              <Select value={asset.type} onChange={(e) => update({ type: e.target.value as PortfolioAssetType })}>
                {ASSET_TYPES.map((type) => (
                  <option key={type} value={type}>{type}</option>
                ))}
              </Select>
            </Field>
            <Field label="Status">
              <StatusSelect value={asset.status} onChange={(status) => update({ status })} />
            </Field>
          </div>
          <Field label="URL">
            <Input value={asset.url ?? ''} onChange={(e) => update({ url: e.target.value || undefined })} placeholder="https://…" />
          </Field>
          <Field label="Description">
            <Textarea rows={2} value={asset.description ?? ''} onChange={(e) => update({ description: e.target.value || undefined })} />
          </Field>
          <Field label="Tags">
            <TagInput ariaLabel="Portfolio tags" values={asset.tags} onChange={(tags) => update({ tags })} />
          </Field>
        </div>
      )}
    />
  )
}
