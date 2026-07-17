import { useMemo, useState } from 'react'
import { Search } from 'lucide-react'
import type { FactType, UnclassifiedFact } from '@/types/resume'
import { PageHeader } from '@/components/ui/PageHeader'
import { Input } from '@/components/ui/Input'
import { useResumeStore } from '@/stores/resumeStore'
import { removeById } from '@/utils/collections'
import { knowledgeStats } from '@/services/knowledge/search'
import { classifyFact } from '@/services/knowledge/classify'
import { FactsSection } from './components/FactsSection'
import { DecisionsSection } from './components/DecisionsSection'
import { TriageSection } from './components/TriageSection'
import { MetricsSection } from './components/MetricsSection'
import { LearningSection } from './components/LearningSection'

type SectionKey = 'facts' | 'decisions' | 'triage' | 'metrics' | 'learning'

export function KnowledgeBasePage() {
  const knowledgeBase = useResumeStore((state) => state.knowledgeBase)
  const patchKnowledgeBase = useResumeStore((state) => state.patchKnowledgeBase)
  const [query, setQuery] = useState('')
  const [section, setSection] = useState<SectionKey>('facts')

  const stats = useMemo(() => knowledgeStats(knowledgeBase), [knowledgeBase])

  const tabs: { key: SectionKey; label: string; count: number }[] = [
    { key: 'facts', label: 'Facts', count: stats.facts },
    { key: 'decisions', label: 'Decisions', count: stats.decisions },
    { key: 'triage', label: 'Triage inbox', count: stats.inbox },
    { key: 'metrics', label: 'Metrics', count: stats.metrics },
    { key: 'learning', label: 'Learning', count: stats.learning },
  ]

  const classify = (item: UnclassifiedFact, type: FactType) =>
    patchKnowledgeBase({
      facts: [classifyFact(item, type), ...knowledgeBase.facts],
      unclassifiedFacts: removeById(knowledgeBase.unclassifiedFacts, item.id),
    })

  return (
    <div className="p-8 max-w-4xl mx-auto animate-fade-in">
      <PageHeader
        title="Knowledge Base"
        subtitle="Your searchable career wiki — facts, technical decisions, metrics, and learning that power resume tailoring and interview prep."
      />

      {stats.needsReview > 0 && (
        <p className="text-sm text-amber-400/90 mb-4">
          {stats.needsReview} fact{stats.needsReview === 1 ? '' : 's'} still need review.
        </p>
      )}

      <div className="relative mb-6">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-faint" aria-hidden />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search across your knowledge base…"
          aria-label="Search knowledge base"
          className="pl-9"
        />
      </div>

      <div className="flex flex-wrap gap-2 mb-6 border-b border-edge pb-4">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setSection(tab.key)}
            aria-pressed={section === tab.key}
            className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm transition-colors ${
              section === tab.key ? 'bg-white text-black font-medium' : 'text-muted hover:text-ink-2 hover:bg-surface'
            }`}
          >
            {tab.label}
            <span className={`text-xs ${section === tab.key ? 'text-black/60' : 'text-faint'}`}>{tab.count}</span>
          </button>
        ))}
      </div>

      {section === 'facts' && (
        <FactsSection facts={knowledgeBase.facts} query={query} onChange={(facts) => patchKnowledgeBase({ facts })} />
      )}
      {section === 'decisions' && (
        <DecisionsSection
          decisions={knowledgeBase.technicalDecisions}
          query={query}
          onChange={(technicalDecisions) => patchKnowledgeBase({ technicalDecisions })}
        />
      )}
      {section === 'triage' && (
        <TriageSection
          items={knowledgeBase.unclassifiedFacts}
          query={query}
          onClassify={classify}
          onDismiss={(id) => patchKnowledgeBase({ unclassifiedFacts: removeById(knowledgeBase.unclassifiedFacts, id) })}
        />
      )}
      {section === 'metrics' && (
        <MetricsSection metrics={knowledgeBase.metrics} query={query} onChange={(metrics) => patchKnowledgeBase({ metrics })} />
      )}
      {section === 'learning' && (
        <LearningSection
          learning={knowledgeBase.learning}
          query={query}
          onChange={(learning) => patchKnowledgeBase({ learning })}
        />
      )}
    </div>
  )
}
