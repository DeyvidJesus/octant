import { type ReactNode, useId, useState } from 'react'
import { ChevronDown, ChevronRight, Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { IconButton } from '@/components/ui/IconButton'
import { confirm } from '@/stores/confirmStore'
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

/** Collapsible add/edit/delete list for a knowledge collection. */
// Search only hides items; every mutation maps back to the full array by id.
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
  const listId = useId()
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
            {/* Toggle and Delete are siblings because nested buttons are invalid HTML. */}
            <div className="flex items-center gap-3 pr-3 hover:bg-surface/50 transition-colors">
              <button
                type="button"
                onClick={() => toggle(item.id)}
                aria-expanded={isExpanded}
                aria-controls={`${listId}-${item.id}`}
                className="flex flex-1 items-center gap-2 min-w-0 px-4 py-3 text-left text-xs text-faint uppercase tracking-wider"
              >
                {isExpanded
                  ? <ChevronDown size={14} className="text-muted shrink-0" aria-hidden />
                  : <ChevronRight size={14} className="text-muted shrink-0" aria-hidden />}
                {itemTitle?.(item)}
              </button>
              <IconButton
                icon={Trash2}
                label="Delete"
                tone="danger"
                onClick={async () => {
                  const ok = await confirm({
                    title: 'Delete this entry?',
                    message: 'It will be removed from your knowledge base and from any resume built from it.',
                    confirmLabel: 'Delete',
                    tone: 'danger',
                  })
                  if (ok) onChange(removeById(items, item.id))
                }}
              />
            </div>
            {isExpanded && (
              <div id={`${listId}-${item.id}`} className="px-4 pb-4 pt-1 border-t border-edge">
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
