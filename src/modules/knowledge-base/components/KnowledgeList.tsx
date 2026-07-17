import type { ReactNode } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { IconButton } from '@/components/ui/IconButton'
import { removeById, updateById } from '@/utils/collections'

interface KnowledgeListProps<T extends { id: string }> {
  items: T[]
  onChange: (next: T[]) => void
  create: () => T
  addLabel: string
  emptyHint: string
  renderItem: (item: T, update: (patch: Partial<T>) => void) => ReactNode
  itemTitle?: (item: T) => ReactNode
  /** Hides non-matching items from a search query while editing the full list. */
  isVisible?: (item: T) => boolean
}

/**
 * Add / edit / delete chrome for a knowledge collection. Unlike the resume
 * EntityList, it supports a search filter that hides non-matching items without
 * ever truncating the underlying collection — every mutation maps back to the
 * full array by id.
 */
export function KnowledgeList<T extends { id: string }>({
  items,
  onChange,
  create,
  addLabel,
  emptyHint,
  renderItem,
  itemTitle,
  isVisible,
}: KnowledgeListProps<T>) {
  const visible = isVisible ? items.filter(isVisible) : items

  return (
    <div className="space-y-4">
      {items.length === 0 && <p className="text-sm text-muted">{emptyHint}</p>}
      {items.length > 0 && visible.length === 0 && (
        <p className="text-sm text-muted">No entries match your search.</p>
      )}

      {visible.map((item) => (
        <div key={item.id} className="border border-edge rounded-lg p-4 bg-base">
          <div className="flex items-start justify-between gap-3 mb-3">
            <span className="text-xs text-faint uppercase tracking-wider">{itemTitle?.(item)}</span>
            <IconButton
              icon={Trash2}
              label="Delete"
              tone="danger"
              onClick={() => onChange(removeById(items, item.id))}
            />
          </div>
          {renderItem(item, (patch) => onChange(updateById(items, item.id, patch)))}
        </div>
      ))}

      <Button variant="subtle" onClick={() => onChange([create(), ...items])}>
        <Plus size={14} aria-hidden /> {addLabel}
      </Button>
    </div>
  )
}
