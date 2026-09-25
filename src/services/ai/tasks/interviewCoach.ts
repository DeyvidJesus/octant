import type { JobOpportunity } from '@/types/job'
import type { MasterResume } from '@/types/resume'
import { collectResumeSkills } from '@/services/analysis/match'
import { extractSkills } from '@/services/analysis/extract'
import { getProvider } from '../providers'
import { checkGrounding, type GroundingReport } from '../guardrails/grounding'
import { AiError, type AiRunConfig, type ChatMessage } from '../types'

// Strict interviewer critique of one practice answer; the grounding check flags invented skills.

export interface InterviewCoachInput {
  job: Pick<JobOpportunity, 'company' | 'role' | 'description'>
  question: string
  userAnswer: string
  expectedAnswer: string
  resume: MasterResume
  /** Specific resume facts/stories the candidate selected as relevant evidence. */
  resumeEvidence: string[]
  /** Skills required by the selected job that the resume does not substantiate. */
  missingSkills: string[]
}

export interface InterviewCoachFeedback {
  score: number
  verdict: string
  strengths: string[]
  gaps: string[]
  idealAnswer: string
  hardFollowUps: string[]
  nextStudyAction: string
}

export interface InterviewCoachResult extends InterviewCoachFeedback {
  grounding: GroundingReport
  model: string
  providerId: string
}

const SYSTEM_PROMPT = [
  'You are a Senior Engineer interviewer evaluating one practice interview answer.',
  'You are not a teacher, tutor, cheerleader, or generic assistant. Behave like the senior engineer on the interview loop who must decide whether this answer would pass.',
  '',
  'Hard rules:',
  '- Use ONLY the selected job description, selected question, expected answer, user answer, selected Master Resume evidence, and listed missing skills provided in the user message.',
  '- Never invent experience, employers, projects, metrics, seniority, production incidents, or technologies outside the Master Resume evidence or selected job description.',
  '- If the user answer claims experience not backed by the selected Master Resume evidence, mark it as a gap instead of accepting it as true.',
  '- If a missing skill matters to the answer, challenge it plainly. Do not imply the candidate has used it.',
  '- Challenge vague answers with hard follow-ups such as: "Why this technology?", "What tradeoff are you accepting?", "How would this fail in production?", "How would you monitor it?"',
  '- Be direct, technical, and concise. No generic encouragement.',
  '- Output ONLY valid JSON. No prose, markdown, or code fences.',
].join('\n')

/** Exported for testing: assembles the grounded interview fact sheet. */
export function buildInterviewCoachPrompt(input: InterviewCoachInput): string {
  return [
    `ROLE: ${input.job.role} at ${input.job.company}`,
    `SELECTED JOB DESCRIPTION:\n${input.job.description}`,
    '',
    `SELECTED QUESTION:\n${input.question}`,
    '',
    `USER ANSWER:\n${input.userAnswer}`,
    '',
    `EXPECTED ANSWER:\n${input.expectedAnswer}`,
    '',
    `SELECTED MASTER RESUME EVIDENCE:\n${list(input.resumeEvidence)}`,
    '',
    `MISSING SKILLS FROM SELECTED JOB:\n${list(input.missingSkills)}`,
    '',
    'Return this exact JSON object:',
    '{',
    '  "score": number,              // integer 0-100, calibrated like a real senior-engineer interview pass/fail signal',
    '  "verdict": string,            // blunt pass/weak-pass/fail style assessment with why',
    '  "strengths": string[],        // what the answer did well, only from provided facts',
    '  "gaps": string[],             // vague claims, missing tradeoffs, unsupported experience, or missing skills',
    '  "idealAnswer": string,        // improved answer using only provided resume evidence and selected job facts',
    '  "hardFollowUps": string[],    // 3-5 senior-engineer follow-up questions that pressure-test the answer',
    '  "nextStudyAction": string     // one concrete thing to study or rehearse next',
    '}',
  ].join('\n')
}

function list(items: string[]): string {
  return items.length ? items.map((item) => `- ${item}`).join('\n') : '- none'
}

export function parseInterviewCoachJson(text: string): unknown {
  const start = text.indexOf('{')
  const end = text.lastIndexOf('}')
  if (start === -1 || end === -1 || end < start) {
    throw new Error('No JSON object found in the model output.')
  }
  const parsed: unknown = JSON.parse(text.slice(start, end + 1))
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    throw new Error('Model output is not a JSON object.')
  }
  return parsed
}

function cleanString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function cleanStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value.map(cleanString).filter(Boolean)
}

export function normalizeInterviewFeedback(raw: unknown): InterviewCoachFeedback {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    throw new Error('Model output is not an object.')
  }
  const record = raw as Record<string, unknown>
  const score = typeof record.score === 'number' && Number.isFinite(record.score)
    ? Math.max(0, Math.min(100, Math.round(record.score)))
    : 0

  return {
    score,
    verdict: cleanString(record.verdict),
    strengths: cleanStringArray(record.strengths),
    gaps: cleanStringArray(record.gaps),
    idealAnswer: cleanString(record.idealAnswer),
    hardFollowUps: cleanStringArray(record.hardFollowUps),
    nextStudyAction: cleanString(record.nextStudyAction),
  }
}

export async function interviewCoach(
  input: InterviewCoachInput,
  config: AiRunConfig,
  signal?: AbortSignal,
): Promise<InterviewCoachResult> {
  const provider = getProvider(config.providerId)
  const messages: ChatMessage[] = [
    { role: 'system', content: SYSTEM_PROMPT },
    { role: 'user', content: buildInterviewCoachPrompt(input) },
  ]

  const complete = (msgs: ChatMessage[]) =>
    provider.complete({
      model: config.model,
      apiKey: config.apiKey,
      baseUrl: config.baseUrl,
      temperature: 0.2,
      maxTokens: 1400,
      signal,
      messages: msgs,
    })

  const first = await complete(messages)
  let parsed: unknown
  try {
    parsed = parseInterviewCoachJson(first.text)
  } catch {
    const retry = await complete([
      ...messages,
      { role: 'assistant', content: first.text },
      { role: 'user', content: 'That was not valid JSON. Reply with ONLY the JSON object in the requested schema.' },
    ])
    try {
      parsed = parseInterviewCoachJson(retry.text)
    } catch {
      throw new AiError('The model did not return valid interview-coach JSON after two attempts. Try a more capable model, or shorten the answer.')
    }
  }

  const feedback = normalizeInterviewFeedback(parsed)
  const known = collectResumeSkills(input.resume)
  for (const hit of extractSkills(input.job.description)) known.add(hit.entry.canonical)
  for (const skill of input.missingSkills) known.add(skill)

  return {
    ...feedback,
    grounding: checkGrounding(JSON.stringify(feedback), known),
    model: first.model,
    providerId: first.providerId,
  }
}
