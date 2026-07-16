import type {
  Accomplishment,
  CareerFact,
  CareerKnowledgeBase,
  Certification,
  Education,
  ResumeProjection,
} from '@/types/resume'

const RESUME_FACT_TYPES = new Set([
  'responsibility', 'action', 'achievement', 'result', 'business_value',
  'product_impact', 'leadership', 'mentoring', 'communication',
  'stakeholder_interaction', 'client_interaction', 'problem_solving',
  'technical_capability',
])

/**
 * The only bridge from the persisted knowledge base to existing resume
 * consumers. Its filters are intentionally strict: pending work and
 * unreviewed migration output can never become a resume claim.
 */
export function projectKnowledgeBase(knowledgeBase: CareerKnowledgeBase): ResumeProjection {
  const facts = knowledgeBase.facts.filter((fact) => fact.status === 'confirmed')
  const skillById = new Map(knowledgeBase.skills.map((skill) => [skill.id, skill]))
  const metricById = new Map(knowledgeBase.metrics.filter((metric) => metric.status === 'confirmed').map((metric) => [metric.id, metric]))
  const factsFor = (predicate: (fact: CareerFact) => boolean) => facts.filter(predicate)
  const accomplishment = (fact: CareerFact): Accomplishment => ({
    id: fact.id,
    text: fact.statement,
    skills: fact.skillIds.map((id) => skillById.get(id)?.canonical).filter((value): value is string => Boolean(value)),
    metric: fact.metricIds.map((id) => metricById.get(id)?.statement).find((value): value is string => Boolean(value)),
    keywords: fact.tags,
  })

  const organizationById = new Map(knowledgeBase.organizations.map((organization) => [organization.id, organization]))
  const experience = knowledgeBase.roles.map((role) => ({
    id: role.id,
    company: organizationById.get(role.organizationId)?.name ?? 'TODO: organization',
    role: role.title,
    duration: role.period,
    location: role.location,
    accomplishments: factsFor((fact) => fact.roleIds.includes(role.id) && RESUME_FACT_TYPES.has(fact.type)).map(accomplishment),
  }))

  const projects = knowledgeBase.initiatives.map((initiative) => ({
    id: initiative.id,
    name: initiative.name,
    tech: initiative.technologySkillIds.map((id) => skillById.get(id)?.canonical).filter((value): value is string => Boolean(value)),
    description: initiative.description ?? '',
    url: initiative.url,
    accomplishments: factsFor((fact) => fact.initiativeIds.includes(initiative.id) && RESUME_FACT_TYPES.has(fact.type)).map(accomplishment),
  }))

  const statement = (ids: string[]) => ids.map((id) => facts.find((fact) => fact.id === id)?.statement).filter((value): value is string => Boolean(value)).join(' ')
  const stories = knowledgeBase.stories
    .filter((story) => story.status === 'confirmed')
    .map((story) => ({
      id: story.id,
      title: story.title,
      situation: statement(story.situationFactIds),
      task: statement(story.taskFactIds),
      action: statement(story.actionFactIds),
      result: statement(story.resultFactIds),
      skills: story.skillIds.map((id) => skillById.get(id)?.canonical).filter((value): value is string => Boolean(value)),
      competencies: story.competencies,
      experienceId: story.roleIds[0],
      tags: story.tags,
    }))

  const certifications: Certification[] = knowledgeBase.credentials
    .filter((credential) => credential.status === 'confirmed' && credential.type === 'certification')
    .map((credential) => ({ id: credential.id, name: credential.name, issuer: credential.issuer ?? '', issuedAt: credential.issuedAt, expiresAt: credential.expiresAt, credentialId: credential.credentialId, url: credential.url }))
  const education: Education[] = knowledgeBase.credentials
    .filter((credential) => credential.status === 'confirmed' && credential.type === 'education')
    .map((credential) => ({ id: credential.id, institution: credential.issuer ?? '', degree: credential.name, field: credential.field ?? '', start: credential.start, end: credential.end, notes: credential.notes }))

  return {
    personal: knowledgeBase.profile.personal,
    summary: knowledgeBase.profile.summary,
    goals: knowledgeBase.profile.careerDirection,
    values: knowledgeBase.profile.values,
    experience,
    projects,
    skills: knowledgeBase.skills.map(({ evidenceFactIds: _evidenceFactIds, provenance: _provenance, ...skill }) => skill),
    stories,
    certifications,
    education,
    publications: knowledgeBase.publications.filter((publication) => publication.status === 'confirmed').map(({ status: _status, provenance: _provenance, ...publication }) => publication),
    learning: knowledgeBase.learning.filter((entry) => entry.status === 'confirmed').map((entry) => ({ ...entry, skills: entry.skillIds.map((id) => skillById.get(id)?.canonical).filter((value): value is string => Boolean(value)) })),
    portfolio: knowledgeBase.portfolioAssets.filter((asset) => asset.status === 'confirmed' && Boolean(asset.url)).map((asset) => ({ id: asset.id, title: asset.title, type: asset.type, url: asset.url!, description: asset.description, tags: asset.tags })),
    languages: knowledgeBase.profile.languages,
    updatedAt: knowledgeBase.updatedAt,
  }
}
