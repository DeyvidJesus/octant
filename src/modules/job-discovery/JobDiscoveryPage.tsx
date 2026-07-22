import { useEffect, useMemo, useState } from 'react'
import { ClipboardPaste, FlaskConical, Radar, type LucideIcon } from 'lucide-react'
import { PageHeader } from '@/components/ui/PageHeader'
import { SectionLabel } from '@/components/ui/SectionLabel'
import { resolveAiRunConfig } from '@/stores/settingsStore'
import { useDiscoveryStore } from '@/stores/discoveryStore'
import { AgentStatusHeader } from './components/AgentStatusHeader'
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

  // Viewing the feed marks it seen (clears the "N new" badge/digest) when the user navigates away.
  useEffect(() => () => useDiscoveryStore.getState().markSeen(), [])

  return (
    <div className="p-8 max-w-4xl mx-auto animate-fade-in pb-24">
      <PageHeader
        title="Opportunities"
        subtitle="Your discovery agent continuously finds and ranks openings against your profile. Fresh, deduped, scored opportunities stream in below — you just review and approve. Configure what it looks for in Settings."
      />

      <div className="mb-8">
        <AgentStatusHeader />
      </div>

      {/* The live, ranked feed — the primary surface. */}
      <ReviewQueue />

      {/* Manual sources are a secondary boost — the agent is the default. */}
      <div className="mt-12">
        <SectionLabel className="mb-3">Manual sources</SectionLabel>
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

        <div className="animate-rise-in" key={source}>
          {source === 'paste' && <PasteImportPanel config={config} />}
          {source === 'sweep' && <SweepPanel config={config} />}
          {source === 'deep-research' && <DeepResearchPanel config={config} />}
        </div>
      </div>
    </div>
  )
}
