import { useEffect, useMemo, useState } from 'react'
import { ClipboardPaste, FlaskConical, Radar, type LucideIcon } from 'lucide-react'
import { PageHeader } from '@/components/ui/PageHeader'
import { useSettingsStore, resolveAiRunConfig } from '@/stores/settingsStore'
import { PasteImportPanel } from './components/PasteImportPanel'
import { SweepPanel } from './components/SweepPanel'
import { DeepResearchPanel } from './components/DeepResearchPanel'
import { ReviewQueue } from './components/ReviewQueue'

type SourceId = 'paste' | 'sweep' | 'deep-research'

const SOURCES: Array<{ id: SourceId; title: string; hint: string; icon: LucideIcon }> = [
  { id: 'paste', title: 'Paste Report', hint: 'free', icon: ClipboardPaste },
  { id: 'sweep', title: 'Web Sweep', hint: '~cents', icon: Radar },
  { id: 'deep-research', title: 'Deep Research', hint: '$1–3', icon: FlaskConical },
]

export function JobDiscoveryPage() {
  const [source, setSource] = useState<SourceId>('paste')

  const config = useMemo(() => resolveAiRunConfig(), [])

  return (
    <div className="p-8 max-w-4xl mx-auto animate-fade-in pb-24">
      <PageHeader
        title="Import & Discover"
        subtitle="Bring real openings into CareerOS — from a pasted research report or an in-app search. Everything lands in a review queue: deduped, scored against your Master Resume, and only added to the board when you approve."
      />

      <div className="flex gap-2 mb-6" role="tablist" aria-label="Discovery source">
        {SOURCES.map((entry) => (
          <button
            key={entry.id}
            role="tab"
            aria-selected={source === entry.id}
            onClick={() => setSource(entry.id)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm transition border ${
              source === entry.id
                ? 'bg-surface-2 text-white border-edge-2'
                : 'text-muted hover:text-ink-2 border-transparent'
            }`}
          >
            <entry.icon size={14} aria-hidden />
            {entry.title}
            <span className="text-[10px] text-faint">{entry.hint}</span>
          </button>
        ))}
      </div>

      <div className="mb-10 animate-rise-in" key={source}>
        {source === 'paste' && <PasteImportPanel config={config} />}
        {source === 'sweep' && <SweepPanel config={config} />}
        {source === 'deep-research' && <DeepResearchPanel config={config} />}
      </div>

      <ReviewQueue />
    </div>
  )
}
