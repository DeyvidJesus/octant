import type {
  CareerFact,
  CareerKnowledgeBase,
  Credential,
  MasterResume,
  Provenance,
  ResumeProjection,
  KnowledgeSkill,
} from '@/types/resume'
import { createSeedKnowledgeBase } from '@/constants/seedData'
import { createId } from '@/utils/id'

/** The v3 persisted slice deliberately contains no nested resume document. */
export interface PersistedResume { knowledgeBase: CareerKnowledgeBase }

export function migrateResumeState(persisted: unknown, fromVersion: number): PersistedResume {
  if (fromVersion >= 3) return persisted as PersistedResume
  const source = persisted as { resume?: ResumeProjection } | undefined
  if (!source?.resume) return { knowledgeBase: createSeedKnowledgeBase() }
  return { knowledgeBase: migrateV2ToV3(fromVersion === 1 ? migrateV1ToV2(source.resume as unknown as LegacyResume) : source.resume) }
}

interface LegacyResume {
  personal?: { name?: string; role?: string; location?: string; english?: string }
  summary?: string
  goals?: string
  values?: string[]
  experience?: Array<{ id?: string; company?: string; role?: string; duration?: string; bullets?: string[] }>
  projects?: Array<{ id?: string; name?: string; tech?: string[]; description?: string; bullets?: string[] }>
  skills?: Array<{ label?: string; skills?: string[] }>
  updatedAt?: string
}

function legacyProvenance(excerpt: string): Provenance {
  return { source: 'Migrated CareerOS resume', excerpt, notes: 'Normalized from the prior resume schema.' }
}

function migrateV1ToV2(old: LegacyResume): ResumeProjection {
  const languages = [{ id: createId(), name: 'Portuguese', level: 'Native', provenance: legacyProvenance('Portuguese — Native') }]
  if (old.personal?.english) languages.push({ id: createId(), name: 'English', level: old.personal.english, provenance: legacyProvenance(`English — ${old.personal.english}`) })
  const skills = (old.skills ?? []).flatMap((group) => (group.skills ?? []).map((canonical) => ({ id: createId(), canonical, category: group.label ?? 'Other' })))
  return {
    personal: { name: old.personal?.name ?? '', role: old.personal?.role ?? '', location: old.personal?.location ?? '' },
    summary: old.summary ?? '', goals: old.goals ?? '', values: old.values ?? [],
    experience: (old.experience ?? []).map((entry) => ({ id: entry.id ?? createId(), company: entry.company ?? '', role: entry.role ?? '', duration: entry.duration ?? '', accomplishments: (entry.bullets ?? []).map((text) => ({ id: createId(), text, skills: [], keywords: [] })) })),
    projects: (old.projects ?? []).map((project) => ({ id: project.id ?? createId(), name: project.name ?? '', tech: project.tech ?? [], description: project.description ?? '', accomplishments: (project.bullets ?? []).map((text) => ({ id: createId(), text, skills: [], keywords: [] })) })),
    skills, stories: [], certifications: [], education: [], publications: [], learning: [], portfolio: [], languages,
    updatedAt: old.updatedAt ?? new Date().toISOString(),
  }
}

function classifyFact(statement: string): CareerFact['type'] | undefined {
  const normalized = statement.trim().toLowerCase()
  if (/^(develop|maintain|ensure|manage|participate|deliver)/.test(normalized)) return 'responsibility'
  if (/^(architect|integrat|implement|engineer|build|built|containeriz|optimiz|profil|design)/.test(normalized)) return 'technical_capability'
  if (/improv|reduc|increas|pass|result|achiev/.test(normalized)) return 'achievement'
  return undefined
}

/**
 * Semantic migration: records are classified into entities and atomic facts;
 * text without a safe category remains reviewable rather than being guessed.
 */
export function migrateV2ToV3(resume: MasterResume): CareerKnowledgeBase {
  const skills: KnowledgeSkill[] = resume.skills.map((entry) => ({
    ...entry, evidenceFactIds: [], provenance: legacyProvenance(entry.canonical),
  }))
  const skillIdByCanonical = new Map(skills.map((entry) => [entry.canonical, entry.id]))
  const organizations: CareerKnowledgeBase['organizations'] = []
  const organizationByName = new Map<string, string>()
  const organizationId = (name: string) => {
    const existing = organizationByName.get(name)
    if (existing) return existing
    const id = createId()
    organizations.push({ id, name, type: name === 'Freelance' ? 'personal' : 'employer', provenance: legacyProvenance(name) })
    organizationByName.set(name, id)
    return id
  }
  const roles = resume.experience.map((entry) => ({ id: entry.id, organizationId: organizationId(entry.company), title: entry.role, period: entry.duration, location: entry.location, provenance: legacyProvenance(`${entry.company} | ${entry.role} | ${entry.duration}`) }))
  const initiatives = resume.projects.map((entry) => ({ id: entry.id, name: entry.name, type: 'portfolio_project' as const, description: entry.description, roleIds: [], technologySkillIds: entry.tech.map((name) => skillIdByCanonical.get(name)).filter((value): value is string => Boolean(value)), url: entry.url, provenance: legacyProvenance(entry.name) }))
  const facts: CareerFact[] = []
  const unclassifiedFacts: CareerKnowledgeBase['unclassifiedFacts'] = []
  const addAccomplishments = (items: ResumeProjection['experience'][number]['accomplishments'], roleIds: string[], initiativeIds: string[]) => {
    for (const item of items) {
      const type = classifyFact(item.text)
      if (!type) {
        unclassifiedFacts.push({ id: item.id, rawText: item.text, source: 'Migrated CareerOS resume accomplishment', reason: 'No safe semantic fact classification was available.', status: 'needs_review' })
        continue
      }
      const metricId = item.metric ? createId() : undefined
      facts.push({ id: item.id, type, statement: item.text, status: 'confirmed', roleIds, initiativeIds, skillIds: item.skills.map((name) => skillIdByCanonical.get(name)).filter((value): value is string => Boolean(value)), metricIds: metricId ? [metricId] : [], tags: item.keywords, provenance: legacyProvenance(item.text) })
      if (metricId) {
        metrics.push({ id: metricId, statement: item.metric!, kind: 'qualitative', factIds: [item.id], status: 'confirmed', provenance: legacyProvenance(item.metric!) })
      }
    }
  }
  const metrics: CareerKnowledgeBase['metrics'] = []
  for (const role of resume.experience) addAccomplishments(role.accomplishments, [role.id], [])
  for (const initiative of resume.projects) addAccomplishments(initiative.accomplishments, [], [initiative.id])

  const stories: CareerKnowledgeBase['stories'] = resume.stories.map((story) => {
    const sections: Array<[CareerFact['type'], string, string]> = [['situation', story.situation, 'situation'], ['task', story.task, 'task'], ['action', story.action, 'action'], ['result', story.result, 'result']]
    const ids = new Map<string, string[]>()
    for (const [type, statement, key] of sections) {
      const id = createId()
      facts.push({ id, type, statement, status: 'confirmed', roleIds: story.experienceId ? [story.experienceId] : [], initiativeIds: [], skillIds: story.skills.map((name) => skillIdByCanonical.get(name)).filter((value): value is string => Boolean(value)), metricIds: [], tags: story.tags, provenance: legacyProvenance(statement) })
      ids.set(key, [id])
    }
    return { id: story.id, title: story.title, situationFactIds: ids.get('situation')!, taskFactIds: ids.get('task')!, actionFactIds: ids.get('action')!, resultFactIds: ids.get('result')!, skillIds: story.skills.map((name) => skillIdByCanonical.get(name)).filter((value): value is string => Boolean(value)), competencies: story.competencies, roleIds: story.experienceId ? [story.experienceId] : [], tags: story.tags, status: 'confirmed' as const, provenance: legacyProvenance(story.title) }
  })
  for (const skill of skills) skill.evidenceFactIds = facts.filter((entry) => entry.skillIds.includes(skill.id)).map((entry) => entry.id)

  const credentials: Credential[] = [
    ...resume.certifications.map((entry) => ({ id: entry.id, type: 'certification' as const, name: entry.name, issuer: entry.issuer, issuedAt: entry.issuedAt, expiresAt: entry.expiresAt, credentialId: entry.credentialId, url: entry.url, status: 'confirmed' as const, provenance: legacyProvenance(entry.name) })),
    ...resume.education.map((entry) => ({ id: entry.id, type: 'education' as const, name: entry.degree, issuer: entry.institution, field: entry.field, start: entry.start, end: entry.end, notes: entry.notes, status: 'confirmed' as const, provenance: legacyProvenance(`${entry.institution} | ${entry.degree}`) })),
  ]
  return {
    schemaVersion: 3,
    profile: { personal: resume.personal, summary: resume.summary, careerDirection: resume.goals, values: resume.values, workPreferences: [], languages: resume.languages.map((entry) => ({ ...entry, provenance: entry.provenance ?? legacyProvenance(`${entry.name} — ${entry.level}`) })) },
    organizations, roles, initiatives, skills, facts, metrics, technicalDecisions: [], stories, credentials,
    portfolioAssets: resume.portfolio.map((entry) => ({ id: entry.id, title: entry.title, type: entry.type, url: entry.url, description: entry.description, initiativeIds: [], tags: entry.tags, status: 'confirmed', provenance: legacyProvenance(entry.title) })),
    publications: resume.publications.map((entry) => ({ ...entry, status: 'confirmed', provenance: legacyProvenance(entry.title) })),
    learning: resume.learning.map((entry) => ({ id: entry.id, title: entry.title, provider: entry.provider, completedAt: entry.completedAt, skillIds: entry.skills.map((name) => skillIdByCanonical.get(name)).filter((value): value is string => Boolean(value)), url: entry.url, notes: entry.notes, status: 'confirmed', provenance: legacyProvenance(entry.title) })),
    unclassifiedFacts, updatedAt: resume.updatedAt,
  }
}
