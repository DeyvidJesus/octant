import type { CareerKnowledgeBase } from '@/types/resume'
import { nowIso } from '@/utils/dates'

/** A truly empty knowledge base — the starting point for a new account. */
export function createEmptyKnowledgeBase(): CareerKnowledgeBase {
  return {
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
    updatedAt: nowIso(),
  }
}
