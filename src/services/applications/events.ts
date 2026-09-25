import type { Application, ApplicationEvent, ApplicationEventKind, ApplicationStage } from '@/types/application'
import { createId } from '@/utils/id'

// Pure timeline builders with injected timestamps; each returns a `Partial<Application>` patch.

export function makeEvent(
  kind: ApplicationEventKind,
  at: string,
  extra: Omit<ApplicationEvent, 'id' | 'at' | 'kind'> = {},
): ApplicationEvent {
  return { id: createId(), at, kind, ...extra }
}

export function appendEvent(events: ApplicationEvent[], event: ApplicationEvent): ApplicationEvent[] {
  return [...events, event]
}

/** Records a stage change; no-op patch when the stage is unchanged. */
export function changeStage(app: Application, toStage: ApplicationStage, at: string): Partial<Application> {
  if (app.stage === toStage) return {}
  const event = makeEvent('stage_change', at, { fromStage: app.stage, toStage })
  const patch: Partial<Application> = { stage: toStage, events: appendEvent(app.events, event) }
  // The first move to `applied` seeds appliedAt.
  if (!app.appliedAt && toStage === 'applied') patch.appliedAt = at
  return patch
}

export function logNote(app: Application, text: string, at: string): Partial<Application> {
  const trimmed = text.trim()
  if (!trimmed) return {}
  return { events: appendEvent(app.events, makeEvent('note', at, { text: trimmed })) }
}

export function logContact(app: Application, text: string, at: string): Partial<Application> {
  const trimmed = text.trim()
  if (!trimmed) return {}
  return { events: appendEvent(app.events, makeEvent('contact', at, { text: trimmed })) }
}
