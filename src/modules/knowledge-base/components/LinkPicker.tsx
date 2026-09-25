import { useId } from 'react'
import { cn } from '@/utils/cn'

export interface LinkOption {
  id: string
  label: string
}

interface LinkPickerProps {
  label: string
  options: LinkOption[]
  selected: string[]
  onChange: (next: string[]) => void
  /** Shown when there is nothing to link to yet. */
  emptyHint: string
}

/** Multi-select as toggle buttons: each option is a button with `aria-pressed`, grouped under a label. */
export function LinkPicker({ label, options, selected, onChange, emptyHint }: LinkPickerProps) {
  const labelId = useId()
  const toggle = (id: string) =>
    onChange(selected.includes(id) ? selected.filter((current) => current !== id) : [...selected, id])

  return (
    <div>
      <span id={labelId} className="block text-xs font-semibold text-muted uppercase tracking-widest mb-1.5">
        {label}
      </span>
      {options.length === 0 ? (
        <p className="text-xs text-faint">{emptyHint}</p>
      ) : (
        <div role="group" aria-labelledby={labelId} className="flex flex-wrap gap-2">
          {options.map((option) => {
            const pressed = selected.includes(option.id)
            return (
              <button
                key={option.id}
                type="button"
                aria-pressed={pressed}
                onClick={() => toggle(option.id)}
                className={cn(
                  'px-2.5 py-1 rounded-md border text-xs transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink-strong',
                  pressed
                    ? 'bg-success-deep/30 border-success-deep/50 text-success-soft'
                    : 'bg-surface-2 border-edge-2 text-ink-2 hover:border-edge-3',
                )}
              >
                {option.label}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
