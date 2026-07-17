import { describe, expect, it } from 'vitest'
import { changeStage, logContact, logNote, makeEvent } from './events'
import type { Application } from '@/types/application'

const at = '2026-07-16T12:00:00.000Z'

const app = (overrides: Partial<Application> = {}): Application => ({
  id: 'app-1',
  company: 'Acme',
  role: 'Engineer',
  workMode: 'remote',
  stage: 'saved',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  links: [],
  notes: '',
  events: [{ id: 'e0', at: '2026-01-01T00:00:00.000Z', kind: 'created' }],
  ...overrides,
})

describe('makeEvent', () => {
  it('stamps kind/at and carries extra fields with a generated id', () => {
    const event = makeEvent('note', at, { text: 'called recruiter' })
    expect(event.kind).toBe('note')
    expect(event.at).toBe(at)
    expect(event.text).toBe('called recruiter')
    expect(event.id).toBeTruthy()
  })
})

describe('changeStage', () => {
  it('returns a stage patch with an appended stage_change event', () => {
    const patch = changeStage(app(), 'applied', at)
    expect(patch.stage).toBe('applied')
    expect(patch.events).toHaveLength(2)
    const last = patch.events![1]
    expect(last.kind).toBe('stage_change')
    expect(last.fromStage).toBe('saved')
    expect(last.toStage).toBe('applied')
  })

  it('seeds appliedAt the first time it enters the applied stage', () => {
    expect(changeStage(app(), 'applied', at).appliedAt).toBe(at)
    // Does not overwrite an existing appliedAt.
    expect(changeStage(app({ appliedAt: 'earlier' }), 'applied', at).appliedAt).toBeUndefined()
  })

  it('is a no-op when the stage is unchanged', () => {
    expect(changeStage(app({ stage: 'offer' }), 'offer', at)).toEqual({})
  })
})

describe('logNote / logContact', () => {
  it('appends trimmed note and contact events', () => {
    expect(logNote(app(), '  progress  ', at).events).toHaveLength(2)
    expect(logNote(app(), '  progress  ', at).events![1]).toMatchObject({ kind: 'note', text: 'progress' })
    expect(logContact(app(), 'emailed', at).events![1]).toMatchObject({ kind: 'contact', text: 'emailed' })
  })

  it('ignores empty text', () => {
    expect(logNote(app(), '   ', at)).toEqual({})
    expect(logContact(app(), '', at)).toEqual({})
  })
})
