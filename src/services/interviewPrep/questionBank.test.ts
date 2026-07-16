import { describe, expect, it } from 'vitest'
import { architectureQuestions, questionBank, templateToPrepQuestion } from './questionBank'
import { behavioralQuestions } from './behavioralBank'

describe('templateToPrepQuestion', () => {
  it('maps a static template into a unified architecture PrepQuestion', () => {
    const template = questionBank[0]
    const question = templateToPrepQuestion(template)

    expect(question.category).toBe('architecture')
    expect(question.topic).toBe(template.topic)
    expect(question.expectedAnswer).toBe(template.expectedAnswerOutline.join('\n'))
    expect(question.commonMistakes).toEqual(template.commonMistakes)
    expect(question.followUps).toEqual(template.followUpQuestions)
    expect(['beginner', 'intermediate', 'advanced']).toContain(question.difficulty)
  })

  it('produces one architecture question per bank template with stable ids', () => {
    const questions = architectureQuestions()
    expect(questions).toHaveLength(questionBank.length)
    const ids = questions.map((question) => question.id)
    expect(new Set(ids).size).toBe(ids.length)
    expect(ids.every((id) => id.startsWith('arch-'))).toBe(true)
  })
})

describe('behavioralQuestions', () => {
  it('personalizes prompts with the target company and role', () => {
    const questions = behavioralQuestions({ company: 'Acme', role: 'Staff Engineer' })
    expect(questions.length).toBeGreaterThan(0)
    expect(questions.every((question) => question.category === 'behavioral')).toBe(true)
    expect(questions.some((question) => question.question.includes('Acme'))).toBe(true)
    expect(questions.some((question) => question.question.includes('Staff Engineer'))).toBe(true)
  })

  it('falls back to generic wording without a job', () => {
    const questions = behavioralQuestions()
    expect(questions.some((question) => question.question.includes('this company'))).toBe(true)
  })
})
