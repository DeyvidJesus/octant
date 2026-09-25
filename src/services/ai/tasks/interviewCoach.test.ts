import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createSeedResume } from '@/test/fixtures/sampleCareer'
import { getProvider } from '../providers'
import {
  buildInterviewCoachPrompt,
  interviewCoach,
  normalizeInterviewFeedback,
  parseInterviewCoachJson,
  type InterviewCoachInput,
} from './interviewCoach'

vi.mock('../providers', () => ({
  getProvider: vi.fn(),
}))

const input: InterviewCoachInput = {
  job: {
    company: 'Acme',
    role: 'Senior Frontend Engineer',
    description: 'Build production React and TypeScript systems with observability. Kubernetes is a plus.',
  },
  question: 'How would you design a reliable dashboard?',
  userAnswer: 'I would use React and make it scalable.',
  expectedAnswer: 'Discuss data freshness, failure states, tradeoffs, monitoring, and why React fits the UI needs.',
  resume: createSeedResume(),
  resumeEvidence: ['Built React dashboards with TypeScript and monitored production UX issues.'],
  missingSkills: ['Kubernetes'],
}

describe('buildInterviewCoachPrompt', () => {
  const prompt = buildInterviewCoachPrompt(input)

  it('includes the selected job, question, answer, expected answer, evidence, and gaps', () => {
    expect(prompt).toContain('ROLE: Senior Frontend Engineer at Acme')
    expect(prompt).toContain('SELECTED QUESTION')
    expect(prompt).toContain('USER ANSWER')
    expect(prompt).toContain('EXPECTED ANSWER')
    expect(prompt).toContain('SELECTED MASTER RESUME EVIDENCE')
    expect(prompt).toContain('Kubernetes')
  })

  it('requests the structured interview-coach schema', () => {
    expect(prompt).toContain('"score": number')
    expect(prompt).toContain('"hardFollowUps": string[]')
    expect(prompt).toContain('"nextStudyAction": string')
  })
})

describe('parseInterviewCoachJson', () => {
  it('tolerates prose-wrapped JSON objects', () => {
    expect(parseInterviewCoachJson('ok {"score":75,"verdict":"weak pass"} done')).toEqual({
      score: 75,
      verdict: 'weak pass',
    })
  })
})

describe('normalizeInterviewFeedback', () => {
  it('clamps score and cleans arrays', () => {
    expect(normalizeInterviewFeedback({
      score: 110.4,
      verdict: ' pass ',
      strengths: [' React ', ''],
      gaps: [' vague '],
      idealAnswer: ' better ',
      hardFollowUps: ['Why this technology?'],
      nextStudyAction: ' rehearse tradeoffs ',
    })).toEqual({
      score: 100,
      verdict: 'pass',
      strengths: ['React'],
      gaps: ['vague'],
      idealAnswer: 'better',
      hardFollowUps: ['Why this technology?'],
      nextStudyAction: 'rehearse tradeoffs',
    })
  })
})

describe('interviewCoach', () => {
  beforeEach(() => {
    vi.mocked(getProvider).mockReset()
  })

  it('uses the configured provider and returns grounded structured feedback', async () => {
    const complete = vi.fn().mockResolvedValue({
      text: JSON.stringify({
        score: 72,
        verdict: 'Weak pass: React details are relevant but too vague.',
        strengths: ['Mentions React for the UI.'],
        gaps: ['Does not explain monitoring or failure modes.'],
        idealAnswer: 'I would use React and TypeScript for the dashboard UI, define failure states, and monitor production issues.',
        hardFollowUps: ['Why this technology?', 'How would this fail in production?', 'How would you monitor it?'],
        nextStudyAction: 'Practice one dashboard design answer with tradeoffs and monitoring.',
      }),
      model: 'model-1',
      providerId: 'openai',
    })
    vi.mocked(getProvider).mockReturnValue({ id: 'openai', complete })

    const result = await interviewCoach(input, { providerId: 'openai', model: 'model-1', apiKey: 'key' })

    expect(complete).toHaveBeenCalledWith(expect.objectContaining({
      model: 'model-1',
      apiKey: 'key',
      temperature: 0.2,
    }))
    expect(result.score).toBe(72)
    expect(result.grounding.ok).toBe(true)
  })
})
