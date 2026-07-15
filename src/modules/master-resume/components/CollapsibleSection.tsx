import { useState, type ReactNode } from 'react'
import { ChevronDown } from 'lucide-react'
import { Card } from '@/components/ui/Card'

interface CollapsibleSectionProps {
  title: string
  count?: number
  defaultOpen?: boolean
  children: ReactNode
}

export function CollapsibleSection({ title, count, defaultOpen = false, children }: CollapsibleSectionProps) {
  const [open, setOpen] = useState(defaultOpen)

  return (
    <Card className="p-0 overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-expanded={open}
        className="w-full flex items-center justify-between px-6 py-4 text-left hover:bg-surface-2/50 transition-colors focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-white"
      >
        <span className="flex items-center gap-3">
          <span className="text-lg font-medium text-white">{title}</span>
          {count !== undefined && (
            <span className="text-xs text-faint bg-surface-2 border border-edge rounded-full px-2 py-0.5">{count}</span>
          )}
        </span>
        <ChevronDown
          size={18}
          className={`text-faint transition-transform ${open ? 'rotate-180' : ''}`}
          aria-hidden
        />
      </button>
      {open && <div className="px-6 pb-6 pt-1">{children}</div>}
    </Card>
  )
}
