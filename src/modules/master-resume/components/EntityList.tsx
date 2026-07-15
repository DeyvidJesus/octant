import type { ReactNode } from 'react'
import { Plus, ArrowUp, ArrowDown, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { IconButton } from '@/components/ui/IconButton'
import { move, removeById, updateById } from '@/utils/collections'

interface EntityListProps<T extends { id: string }> {
  items: T[]
  onChange: (next: T[]) => void
  create: () => T
  addLabel: string
  emptyHint: string
  renderItem: (item: T, update: (patch: Partial<T>) => void) => ReactNode
  /** Short summary shown collapsed in the item header (e.g. company name). */
  itemTitle?: (item: T) => string
}

/**
 * Uniform add / reorder / delete chrome for any list of `{ id }` entities.
 * Section editors only supply how to create an item and render its fields.
 */
export function EntityList<T extends { id: string }>({
  items,
  onChange,
  create,
  addLabel,
  emptyHint,
  renderItem,
  itemTitle,
}: EntityListProps<T>) {
  return (
    <div className="space-y-4">
      {items.length === 0 && <p className="text-sm text-muted">{emptyHint}</p>}

      {items.map((item, index) => (
        <div key={item.id} className="border border-edge rounded-lg p-4 bg-base">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs text-faint uppercase tracking-wider truncate">
              {itemTitle?.(item) || `Item ${index + 1}`}
            </span>
            <div className="flex items-center gap-1 shrink-0">
              <IconButton
                icon={ArrowUp}
                label="Move up"
                disabled={index === 0}
                onClick={() => onChange(move(items, index, -1))}
              />
              <IconButton
                icon={ArrowDown}
                label="Move down"
                disabled={index === items.length - 1}
                onClick={() => onChange(move(items, index, 1))}
              />
              <IconButton
                icon={Trash2}
                label="Delete"
                tone="danger"
                onClick={() => onChange(removeById(items, item.id))}
              />
            </div>
          </div>
          {renderItem(item, (patch) => onChange(updateById(items, item.id, patch)))}
        </div>
      ))}

      <Button variant="subtle" onClick={() => onChange([...items, create()])}>
        <Plus size={14} aria-hidden /> {addLabel}
      </Button>
    </div>
  )
}
