import type { JobOpportunity } from '@/types/job'
import type { MasterResume } from '@/types/resume'
import type { InterviewQuestionCategory, PrepDifficulty, PrepQuestion, PrepPriority } from '@/types/interviewPrep'
import { createId } from '@/utils/id'
import { getProvider } from '../providers'
import { AiError, type AiRunConfig, type ChatMessage } from '../types'

// Generates interview questions targeting the skills a job requires but the resume lacks.

export interface InterviewGeneratorInput {
  job: Pick<JobOpportunity, 'company' | 'role' | 'description'>
  resume: MasterResume
  /** Skills the job requires that the resume does not substantiate (analysis.match.missing). */
  missingSkills: string[]
  /** How many questions to request. */
  count?: number
}

const CATEGORIES: InterviewQuestionCategory[] = ['technical', 'behavioral', 'architecture']
const DIFFICULTIES: PrepDifficulty[] = ['beginner', 'intermediate', 'advanced']

const SYSTEM_PROMPT = [
  'You are a Senior Engineer designing a targeted interview for one candidate against one job.',
  'Generate questions that pressure-test the gap between the candidate and the role.',
  '',
  'Hard rules:',
  '- Prioritize the listed MISSING SKILLS — the job requires them and the resume does not substantiate them.',
  '- Ground every question in the provided job description and resume summary. Do not invent employers, projects, or technologies the candidate never mentioned.',
  '- Mix categories: mostly technical (on the missing skills and the role stack), plus a few behavioral and architecture questions.',
  '- Each question must be answerable by a real candidate and have a concrete expected answer outline.',
  '- Output ONLY a valid JSON array. No prose, markdown, or code fences.',
].join('\n')

function resumeSummary(resume: MasterResume): string {
  return [
    `CANDIDATE ROLE: ${resume.personal.role || 'unspecified'}`,
    `SUMMARY: ${resume.summary || 'n/a'}`,
    `SKILLS: ${resume.skills.map((skill) => skill.canonical).join(', ') || 'n/a'}`,
    `EXPERIENCE: ${resume.experience.map((entry) => `${entry.role} at ${entry.company}`).join('; ') || 'n/a'}`,
  ].join('\n')
}

function list(items: string[]): string {
  return items.length ? items.map((item) => `- ${item}`).join('\n') : '- none'
}

/** Exported for testing: assembles the generation prompt. */
export function buildInterviewGeneratorPrompt(input: InterviewGeneratorInput): string {
  const count = input.count ?? 8
  return [
    `ROLE: ${input.job.role} at ${input.job.company}`,
    `JOB DESCRIPTION:\n${input.job.description}`,
    '',
    `CANDIDATE RESUME SUMMARY:\n${resumeSummary(input.resume)}`,
    '',
    `MISSING SKILLS (prioritize these):\n${list(input.missingSkills)}`,
    '',
    `Generate ${count} interview questions as a JSON array. Each element must be exactly:`,
    '{',
    '  "skill": string,        // the single skill/topic the question targets (e.g. "React", "Ownership")',
    '  "category": "technical" | "behavioral" | "architecture",',
    '  "difficulty": "beginner" | "intermediate" | "advanced",',
    '  "question": string,     // the interview question',
    '  "expectedAnswer": string, // a concise model-answer outline',
    '  "whyInterviewersAsk": string // one sentence on what this probes',
    '}',
  ].join('\n')
}

export function parseGeneratedQuestions(text: string, missingSkills: string[] = []): PrepQuestion[] {
  const start = text.indexOf('[')
  const end = text.lastIndexOf(']')
  if (start === -1 || end === -1 || end < start) {
    throw new Error('No JSON array found in the model output.')
  }
  const parsed: unknown = JSON.parse(text.slice(start, end + 1))
  if (!Array.isArray(parsed)) {
    throw new Error('Model output is not a JSON array.')
  }
  const missing = new Set(missingSkills)
  return parsed
    .map((raw) => normalizeQuestion(raw, missing))
    .filter((question): question is PrepQuestion => question !== null)
}

function str(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function normalizeQuestion(raw: unknown, missingSkills: Set<string> = new Set()): PrepQuestion | null {
  if (typeof raw !== 'object' || raw === null) return null
  const record = raw as Record<string, unknown>
  const question = str(record.question)
  if (!question) return null
  const category: InterviewQuestionCategory = CATEGORIES.includes(record.category as InterviewQuestionCategory)
    ? (record.category as InterviewQuestionCategory)
    : 'technical'
  const difficulty: PrepDifficulty = DIFFICULTIES.includes(record.difficulty as PrepDifficulty)
    ? (record.difficulty as PrepDifficulty)
    : 'intermediate'
  const skill = str(record.skill) || category
  const priority: PrepPriority = missingSkills.has(skill) ? 'required-missing' : 'resume-core'

  return {
    id: createId(),
    category,
    difficulty,
    question,
    topic: skill,
    priority,
    expectedAnswer: str(record.expectedAnswer) || undefined,
    whyInterviewersAsk: str(record.whyInterviewersAsk) || undefined,
  }
}

export async function generateInterviewQuestions(
  input: InterviewGeneratorInput,
  config: AiRunConfig,
  signal?: AbortSignal,
): Promise<PrepQuestion[]> {
  const provider = getProvider(config.providerId)
  const messages: ChatMessage[] = [
    { role: 'system', content: SYSTEM_PROMPT },
    { role: 'user', content: buildInterviewGeneratorPrompt(input) },
  ]

  const complete = (msgs: ChatMessage[]) =>
    provider.complete({
      model: config.model,
      apiKey: config.apiKey,
      baseUrl: config.baseUrl,
      temperature: 0.5,
      maxTokens: 2000,
      signal,
      messages: msgs,
    })

  const first = await complete(messages)
  let questions: PrepQuestion[]
  try {
    questions = parseGeneratedQuestions(first.text, input.missingSkills)
  } catch {
    const retry = await complete([
      ...messages,
      { role: 'assistant', content: first.text },
      { role: 'user', content: 'That was not a valid JSON array. Reply with ONLY the JSON array in the requested schema.' },
    ])
    try {
      questions = parseGeneratedQuestions(retry.text, input.missingSkills)
    } catch {
      throw new AiError('The model did not return valid interview questions after two attempts. Try a more capable model.')
    }
  }

  if (questions.length === 0) {
    throw new AiError('The model returned no usable interview questions. Try regenerating.')
  }
  return questions
}
