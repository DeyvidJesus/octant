import { useMemo, useState } from 'react'
import { Search } from 'lucide-react'
import type { FactStatus, FactType, UnclassifiedFact } from '@/types/resume'
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
import { StoriesSection } from './components/StoriesSection'

type SectionKey = 'facts' | 'decisions' | 'stories' | 'triage' | 'metrics' | 'learning'
type StatusFilter = 'all' | FactStatus

const STATUS_FILTERS: { key: StatusFilter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'confirmed', label: 'Confirmed' },
  { key: 'needs_review', label: 'Needs review' },
  { key: 'todo', label: 'To-do' },
]

export function KnowledgeBasePage() {
  const knowledgeBase = useResumeStore((state) => state.knowledgeBase)
  const patchKnowledgeBase = useResumeStore((state) => state.patchKnowledgeBase)
  const [query, setQuery] = useState('')
  const [section, setSection] = useState<SectionKey>('facts')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')

  const stats = useMemo(() => knowledgeStats(knowledgeBase), [knowledgeBase])

  const tabs: { key: SectionKey; label: string; count: number }[] = [
    { key: 'facts', label: 'Facts', count: stats.facts },
    { key: 'decisions', label: 'Decisions', count: stats.decisions },
    { key: 'stories', label: 'Stories', count: stats.stories },
    { key: 'triage', label: 'Triage inbox', count: stats.inbox },
    { key: 'metrics', label: 'Metrics', count: stats.metrics },
    { key: 'learning', label: 'Learning', count: stats.learning },
  ]

  /** True when the section's entities carry a FactStatus field. */
  const sectionHasStatus = section !== 'triage'

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

      <div className="flex flex-wrap gap-2 mb-4 border-b border-edge pb-4">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => { setSection(tab.key); setStatusFilter('all') }}
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

      {sectionHasStatus && (
        <div className="flex flex-wrap gap-1.5 mb-6">
          {STATUS_FILTERS.map((f) => (
            <button
              key={f.key}
              type="button"
              onClick={() => setStatusFilter(f.key)}
              className={`px-2.5 py-1 rounded text-xs transition-colors ${
                statusFilter === f.key
                  ? 'bg-surface-2 text-ink-2 font-medium border border-edge-2'
                  : 'text-faint hover:text-muted hover:bg-surface'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      )}

      {section === 'facts' && (
        <FactsSection
          facts={knowledgeBase.facts}
          query={query}
          statusFilter={statusFilter}
          onChange={(facts) => patchKnowledgeBase({ facts })}
        />
      )}
      {section === 'decisions' && (
        <DecisionsSection
          decisions={knowledgeBase.technicalDecisions}
          query={query}
          statusFilter={statusFilter}
          onChange={(technicalDecisions) => patchKnowledgeBase({ technicalDecisions })}
        />
      )}
      {section === 'stories' && (
        <StoriesSection
          stories={knowledgeBase.stories}
          query={query}
          statusFilter={statusFilter}
          onChange={(stories) => patchKnowledgeBase({ stories })}
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
        <MetricsSection
          metrics={knowledgeBase.metrics}
          query={query}
          statusFilter={statusFilter}
          onChange={(metrics) => patchKnowledgeBase({ metrics })}
        />
      )}
      {section === 'learning' && (
        <LearningSection
          learning={knowledgeBase.learning}
          query={query}
          statusFilter={statusFilter}
          onChange={(learning) => patchKnowledgeBase({ learning })}
        />
      )}
    </div>
  )
}
