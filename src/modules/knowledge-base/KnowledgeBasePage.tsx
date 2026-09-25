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
import { ProfileSection } from './components/ProfileSection'
import { ExperienceSection } from './components/ExperienceSection'
import { ProjectsSection } from './components/ProjectsSection'
import { SkillsSection } from './components/SkillsSection'
import { CredentialsSection } from './components/CredentialsSection'
import { PortfolioSection } from './components/PortfolioSection'
import { PublicationsSection } from './components/PublicationsSection'

type SectionKey =
  | 'profile' | 'experience' | 'projects' | 'skills'
  | 'facts' | 'decisions' | 'stories' | 'metrics' | 'learning'
  | 'credentials' | 'portfolio' | 'publications' | 'triage'
type StatusFilter = 'all' | FactStatus

/** Sections whose entities carry a FactStatus field (and therefore honor the status filter). */
const STATUS_SECTIONS = new Set<SectionKey>([
  'facts', 'decisions', 'stories', 'metrics', 'learning', 'credentials', 'portfolio', 'publications',
])

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

  const tabs: { key: SectionKey; label: string; count?: number }[] = [
    { key: 'profile', label: 'Profile' },
    { key: 'experience', label: 'Experience', count: knowledgeBase.organizations.length + knowledgeBase.roles.length },
    { key: 'projects', label: 'Projects', count: knowledgeBase.initiatives.length },
    { key: 'skills', label: 'Skills', count: knowledgeBase.skills.length },
    { key: 'facts', label: 'Facts', count: stats.facts },
    { key: 'decisions', label: 'Decisions', count: stats.decisions },
    { key: 'stories', label: 'Stories', count: stats.stories },
    { key: 'metrics', label: 'Metrics', count: stats.metrics },
    { key: 'learning', label: 'Learning', count: stats.learning },
    { key: 'credentials', label: 'Credentials', count: knowledgeBase.credentials.length },
    { key: 'portfolio', label: 'Portfolio', count: knowledgeBase.portfolioAssets.length },
    { key: 'publications', label: 'Publications', count: knowledgeBase.publications.length },
    { key: 'triage', label: 'Triage inbox', count: stats.inbox },
  ]

  const sectionHasStatus = STATUS_SECTIONS.has(section)

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
        <p className="text-sm text-warning/90 mb-4">
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
              section === tab.key ? 'bg-inverse text-inverse-ink font-medium' : 'text-muted hover:text-ink-2 hover:bg-surface'
            }`}
          >
            {tab.label}
            {tab.count !== undefined && (
              <span className={`text-xs ${section === tab.key ? 'text-inverse-ink/60' : 'text-faint'}`}>{tab.count}</span>
            )}
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
      {section === 'profile' && (
        <ProfileSection
          profile={knowledgeBase.profile}
          onChange={(profile) => patchKnowledgeBase({ profile })}
        />
      )}
      {section === 'experience' && (
        <ExperienceSection
          organizations={knowledgeBase.organizations}
          roles={knowledgeBase.roles}
          onChangeOrganizations={(organizations) => patchKnowledgeBase({ organizations })}
          onChangeRoles={(roles) => patchKnowledgeBase({ roles })}
          query={query}
        />
      )}
      {section === 'projects' && (
        <ProjectsSection
          initiatives={knowledgeBase.initiatives}
          query={query}
          onChange={(initiatives) => patchKnowledgeBase({ initiatives })}
        />
      )}
      {section === 'skills' && (
        <SkillsSection
          skills={knowledgeBase.skills}
          query={query}
          onChange={(skills) => patchKnowledgeBase({ skills })}
        />
      )}
      {section === 'credentials' && (
        <CredentialsSection
          credentials={knowledgeBase.credentials}
          query={query}
          statusFilter={statusFilter}
          onChange={(credentials) => patchKnowledgeBase({ credentials })}
        />
      )}
      {section === 'portfolio' && (
        <PortfolioSection
          portfolioAssets={knowledgeBase.portfolioAssets}
          query={query}
          statusFilter={statusFilter}
          onChange={(portfolioAssets) => patchKnowledgeBase({ portfolioAssets })}
        />
      )}
      {section === 'publications' && (
        <PublicationsSection
          publications={knowledgeBase.publications}
          query={query}
          statusFilter={statusFilter}
          onChange={(publications) => patchKnowledgeBase({ publications })}
        />
      )}
    </div>
  )
}
