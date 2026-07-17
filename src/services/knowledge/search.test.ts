import { describe, expect, it } from 'vitest'
import { filterByQuery, knowledgeStats, matchesQuery, storyText } from './search'
import type { CareerFact, CareerKnowledgeBase, KnowledgeStory } from '@/types/resume'

describe('matchesQuery', () => {
  it('matches when every token is present, case-insensitively', () => {
    expect(matchesQuery('Migrated Postgres to Aurora', 'postgres aurora')).toBe(true)
    expect(matchesQuery('Migrated Postgres to Aurora', 'postgres mysql')).toBe(false)
  })

  it('treats an empty query as matching everything', () => {
    expect(matchesQuery('anything', '   ')).toBe(true)
  })
})

describe('filterByQuery', () => {
  it('filters items by derived text and returns the full list for an empty query', () => {
    const items = [{ t: 'React hooks' }, { t: 'Postgres indexes' }]
    expect(filterByQuery(items, 'postgres', (i) => i.t)).toEqual([{ t: 'Postgres indexes' }])
    expect(filterByQuery(items, '', (i) => i.t)).toBe(items)
  })
})

const fact = (status: CareerFact['status']): CareerFact => ({
  id: `f-${status}-${Math.random()}`.replace(/[^a-z0-9-]/g, ''),
  type: 'achievement',
  statement: 's',
  status,
  roleIds: [],
  initiativeIds: [],
  skillIds: [],
  metricIds: [],
  tags: [],
  provenance: { source: 'test', excerpt: 's' },
})

const story = (): KnowledgeStory => ({
  id: 'story-1',
  title: 'Led database migration',
  situationFactIds: [],
  taskFactIds: [],
  actionFactIds: [],
  resultFactIds: [],
  skillIds: [],
  competencies: ['leadership', 'architecture'],
  roleIds: [],
  tags: ['migration', 'postgres'],
  status: 'confirmed',
  provenance: { source: 'test', excerpt: '' },
})

const kb = (overrides: Partial<CareerKnowledgeBase> = {}): CareerKnowledgeBase => ({
  schemaVersion: 3,
  profile: {
    personal: { name: '', role: '', location: '' },
    summary: '',
    careerDirection: '',
    values: [],
    workPreferences: [],
    languages: [],
  },
  organizations: [],
  roles: [],
  initiatives: [],
  skills: [],
  facts: [],
  metrics: [],
  technicalDecisions: [],
  stories: [],
  credentials: [],
  portfolioAssets: [],
  publications: [],
  learning: [],
  unclassifiedFacts: [],
  updatedAt: '2026-01-01T00:00:00.000Z',
  ...overrides,
})

describe('storyText', () => {
  it('joins title, competencies, and tags for search', () => {
    const text = storyText(story())
    expect(text).toContain('Led database migration')
    expect(text).toContain('leadership')
    expect(text).toContain('postgres')
  })
})

describe('knowledgeStats', () => {
  it('counts collections and non-confirmed facts as needs-review', () => {
    const stats = knowledgeStats(
      kb({
        facts: [fact('confirmed'), fact('needs_review'), fact('todo')],
        stories: [story()],
        unclassifiedFacts: [{ id: 'u1', rawText: 'note', source: 'test', reason: 'x', status: 'needs_review' }],
      }),
    )
    expect(stats.facts).toBe(3)
    expect(stats.needsReview).toBe(2) // needs_review + todo
    expect(stats.stories).toBe(1)
    expect(stats.inbox).toBe(1)
    expect(stats.decisions).toBe(0)
  })
})
