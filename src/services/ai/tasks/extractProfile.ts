import type {
  CareerFact,
  CareerKnowledgeBase,
  Credential,
  KnowledgeSkill,
  Organization,
  Provenance,
  Role,
} from '@/types/resume'
import { createEmptyKnowledgeBase } from '@/constants/seedData'
import { createId } from '@/utils/id'
import { getProvider } from '../providers'
import { AiError, type AiRunConfig, type ChatMessage } from '../types'

// Onboarding import: the model transcribes pasted résumé text to JSON and code builds the knowledge base.
// Everything lands as `needs_review`, so nothing is used until the user confirms it.

const MAX_INPUT_CHARS = 40_000
const MAX_SKILLS = 80
const MAX_EXPERIENCES = 30
const MAX_BULLETS_PER_EXPERIENCE = 20
const MAX_EDUCATION = 15
const SOURCE_LABEL = 'Onboarding résumé import'

export interface ExtractProfileResult {
  knowledgeBase: CareerKnowledgeBase
  counts: { skills: number; roles: number; facts: number; credentials: number }
  model: string
  providerId: string
}

const SYSTEM_PROMPT = [
  'You are a résumé-parsing engine. You will receive the raw text of a résumé/CV.',
  'Transcribe it into a single JSON object. Output ONLY the JSON object — no prose, no markdown, no code fences.',
  'NEVER invent information the résumé does not contain. Omit anything absent (use null or empty arrays).',
  '',
  'Shape:',
  '{',
  '  "profile": {',
  '    "name": string | null, "role": string | null, "location": string | null, "email": string | null,',
  '    "summary": string | null,          // the professional summary/objective, verbatim or faithfully condensed',
  '    "careerDirection": string | null   // stated career goal, only if present',
  '  },',
  '  "skills": [{ "name": string, "category": string | null }],   // category e.g. "Frontend", "Backend", "Cloud"',
  '  "experiences": [{',
  '    "company": string, "title": string, "period": string | null, "location": string | null,',
  '    "bullets": string[]               // each responsibility/achievement line, verbatim',
  '  }],',
  '  "education": [{ "institution": string, "degree": string | null, "field": string | null, "start": string | null, "end": string | null }]',
  '}',
].join('\n')

/** Exported for testing. */
export function buildExtractProfilePrompt(resumeText: string): string {
  return `RÉSUMÉ:\n\n${resumeText}`
}

/** Tolerates a fenced or prose-wrapped object; throws when no JSON object is found. */
export function parseResumeJson(text: string): unknown {
  const start = text.indexOf('{')
  const end = text.lastIndexOf('}')
  if (start === -1 || end === -1 || end < start) {
    throw new Error('No JSON object found in the model output.')
  }
  return JSON.parse(text.slice(start, end + 1))
}

function str(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function optional(value: unknown): string | undefined {
  const s = str(value)
  return s || undefined
}

/** Builds a knowledge base from untrusted model output; ids and provenance are assigned here, not by the model. */
export function buildKnowledgeBaseFromExtraction(raw: unknown): {
  knowledgeBase: CareerKnowledgeBase
  counts: ExtractProfileResult['counts']
} {
  const kb = createEmptyKnowledgeBase()
  const record = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
  const provenance = (excerpt: string): Provenance => ({ source: SOURCE_LABEL, excerpt })

  // Profile
  const rp = (record.profile && typeof record.profile === 'object' ? record.profile : {}) as Record<string, unknown>
  kb.profile.personal = {
    name: str(rp.name),
    role: str(rp.role),
    location: str(rp.location),
    email: optional(rp.email),
  }
  kb.profile.summary = str(rp.summary)
  kb.profile.careerDirection = str(rp.careerDirection)

  // Skills (dedup by canonical, capped)
  const skills: KnowledgeSkill[] = []
  const seenSkill = new Set<string>()
  if (Array.isArray(record.skills)) {
    for (const item of record.skills) {
      if (skills.length >= MAX_SKILLS) break
      const rec = (item && typeof item === 'object' ? item : {}) as Record<string, unknown>
      const canonical = str(rec.name)
      if (!canonical) continue
      const key = canonical.toLowerCase()
      if (seenSkill.has(key)) continue
      seenSkill.add(key)
      skills.push({
        id: createId(),
        canonical,
        category: str(rec.category) || 'General',
        evidenceFactIds: [],
        provenance: provenance(canonical),
      })
    }
  }

  // Experiences → organizations + roles + facts (bullets)
  const organizations: Organization[] = []
  const roles: Role[] = []
  const facts: CareerFact[] = []
  const orgIdByName = new Map<string, string>()

  if (Array.isArray(record.experiences)) {
    for (const item of record.experiences) {
      if (roles.length >= MAX_EXPERIENCES) break
      const rec = (item && typeof item === 'object' ? item : {}) as Record<string, unknown>
      const company = str(rec.company)
      const title = str(rec.title)
      if (!company && !title) continue

      const orgName = company || 'Unspecified'
      let orgId = orgIdByName.get(orgName.toLowerCase())
      if (!orgId) {
        orgId = createId()
        orgIdByName.set(orgName.toLowerCase(), orgId)
        organizations.push({ id: orgId, name: orgName, type: 'employer', provenance: provenance(orgName) })
      }

      const roleId = createId()
      roles.push({
        id: roleId,
        organizationId: orgId,
        title: title || 'Role',
        period: str(rec.period),
        location: optional(rec.location),
        provenance: provenance([company, title, str(rec.period)].filter(Boolean).join(' | ')),
      })

      const bullets = Array.isArray(rec.bullets) ? rec.bullets : []
      for (const bullet of bullets.slice(0, MAX_BULLETS_PER_EXPERIENCE)) {
        const statement = str(bullet)
        if (!statement) continue
        facts.push({
          id: createId(),
          type: 'responsibility',
          statement,
          status: 'needs_review',
          roleIds: [roleId],
          initiativeIds: [],
          skillIds: [],
          metricIds: [],
          tags: [],
          provenance: provenance(statement),
        })
      }
    }
  }

  // Education → credentials
  const credentials: Credential[] = []
  if (Array.isArray(record.education)) {
    for (const item of record.education) {
      if (credentials.length >= MAX_EDUCATION) break
      const rec = (item && typeof item === 'object' ? item : {}) as Record<string, unknown>
      const institution = str(rec.institution)
      const degree = str(rec.degree)
      if (!institution && !degree) continue
      credentials.push({
        id: createId(),
        type: 'education',
        name: degree || institution,
        issuer: institution || undefined,
        field: optional(rec.field),
        start: optional(rec.start),
        end: optional(rec.end),
        status: 'needs_review',
        provenance: provenance([institution, degree, str(rec.field)].filter(Boolean).join(' | ')),
      })
    }
  }

  kb.skills = skills
  kb.organizations = organizations
  kb.roles = roles
  kb.facts = facts
  kb.credentials = credentials

  return {
    knowledgeBase: kb,
    counts: { skills: skills.length, roles: roles.length, facts: facts.length, credentials: credentials.length },
  }
}

export async function extractProfile(
  resumeText: string,
  config: AiRunConfig,
  signal?: AbortSignal,
): Promise<ExtractProfileResult> {
  const input = resumeText.trim().slice(0, MAX_INPUT_CHARS)
  if (!input) throw new AiError('Paste your résumé text first.')

  const provider = getProvider(config.providerId)
  const messages: ChatMessage[] = [
    { role: 'system', content: SYSTEM_PROMPT },
    { role: 'user', content: buildExtractProfilePrompt(input) },
  ]

  const complete = (msgs: ChatMessage[]) =>
    provider.complete({
      model: config.model,
      apiKey: config.apiKey,
      baseUrl: config.baseUrl,
      temperature: 0,
      maxTokens: 4000,
      signal,
      messages: msgs,
    })

  const first = await complete(messages)
  let parsed: unknown
  try {
    parsed = parseResumeJson(first.text)
  } catch {
    const retry = await complete([
      ...messages,
      { role: 'assistant', content: first.text },
      { role: 'user', content: 'That was not valid JSON. Reply with ONLY the JSON object. No explanation, no code fences.' },
    ])
    try {
      parsed = parseResumeJson(retry.text)
    } catch {
      throw new AiError(
        'The model did not return valid JSON after two attempts. Try a more capable model, or paste less text.',
      )
    }
  }

  const built = buildKnowledgeBaseFromExtraction(parsed)
  return {
    knowledgeBase: built.knowledgeBase,
    counts: built.counts,
    model: first.model,
    providerId: first.providerId,
  }
}
