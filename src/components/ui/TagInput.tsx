import { useState, type KeyboardEvent } from 'react'
import { X } from 'lucide-react'

interface TagInputProps {
  values: string[]
  onChange: (next: string[]) => void
  placeholder?: string
  ariaLabel: string
}

/** Chip-style editor for a list of short strings (skills, tags, tech, values). */
export function TagInput({ values, onChange, placeholder = 'Add and press Enter', ariaLabel }: TagInputProps) {
  const [draft, setDraft] = useState('')

  const commit = () => {
    const value = draft.trim()
    if (value && !values.includes(value)) onChange([...values, value])
    setDraft('')
  }

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter' || event.key === ',') {
      event.preventDefault()
      commit()
    } else if (event.key === 'Backspace' && draft === '' && values.length > 0) {
      onChange(values.slice(0, -1))
    }
  }

  return (
    <div className="flex flex-wrap gap-2 items-center bg-base border border-edge-2 rounded px-2 py-2 focus-within:border-edge-3">
      {values.map((value) => (
        <span key={value} className="inline-flex items-center gap-1 px-2 py-0.5 bg-surface-2 border border-edge-2 rounded text-xs text-ink-2">
          {value}
          <button
            type="button"
            aria-label={`Remove ${value}`}
            onClick={() => onChange(values.filter((v) => v !== value))}
            className="text-faint hover:text-red-400"
          >
            <X size={12} aria-hidden />
          </button>
        </span>
      ))}
      <input
        aria-label={ariaLabel}
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={commit}
        placeholder={placeholder}
        className="flex-1 min-w-[8rem] bg-transparent text-sm text-ink-2 placeholder:text-faint focus:outline-none"
      />
    </div>
  )
}
