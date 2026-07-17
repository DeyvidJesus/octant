import { type ReactNode, useState } from 'react'
import { ChevronDown, ChevronRight, Plus, Trash2 } from 'lucide-react'
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
 *
 * Items start collapsed (title row only) and expand on click. Newly added items
 * expand automatically so the user can start editing immediately.
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
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())

  const toggle = (id: string) =>
    setExpandedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  const addItem = () => {
    const item = create()
    setExpandedIds((prev) => new Set(prev).add(item.id))
    onChange([item, ...items])
  }

  return (
    <div className="space-y-2">
      {items.length === 0 && <p className="text-sm text-muted">{emptyHint}</p>}
      {items.length > 0 && visible.length === 0 && (
        <p className="text-sm text-muted">No entries match your search.</p>
      )}

      {visible.map((item) => {
        const isExpanded = expandedIds.has(item.id)
        return (
          <div key={item.id} className="border border-edge rounded-lg bg-base overflow-hidden">
            <button
              type="button"
              onClick={() => toggle(item.id)}
              className="flex items-center justify-between gap-3 w-full px-4 py-3 text-left hover:bg-surface/50 transition-colors"
            >
              <span className="flex items-center gap-2 text-xs text-faint uppercase tracking-wider min-w-0">
                {isExpanded
                  ? <ChevronDown size={14} className="text-muted shrink-0" aria-hidden />
                  : <ChevronRight size={14} className="text-muted shrink-0" aria-hidden />}
                {itemTitle?.(item)}
              </span>
              <IconButton
                icon={Trash2}
                label="Delete"
                tone="danger"
                onClick={(e) => { e.stopPropagation(); onChange(removeById(items, item.id)) }}
              />
            </button>
            {isExpanded && (
              <div className="px-4 pb-4 pt-1 border-t border-edge">
                {renderItem(item, (patch) => onChange(updateById(items, item.id, patch)))}
              </div>
            )}
          </div>
        )
      })}

      <Button variant="subtle" onClick={addItem}>
        <Plus size={14} aria-hidden /> {addLabel}
      </Button>
    </div>
  )
}
