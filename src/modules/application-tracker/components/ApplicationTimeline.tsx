import { useState } from 'react'
import { ArrowRight, CircleDot, MessageSquare, Phone, Sparkles } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import type { Application, ApplicationEvent } from '@/types/application'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { SectionLabel } from '@/components/ui/SectionLabel'
import { useApplicationsStore } from '@/stores/applicationsStore'
import { makeEvent } from '@/services/applications/events'
import { APPLICATION_STAGE_LABELS } from '@/constants/applicationStages'
import { formatDate, formatRelative, nowIso } from '@/utils/dates'

const KIND_ICON: Record<ApplicationEvent['kind'], LucideIcon> = {
  created: Sparkles,
  stage_change: ArrowRight,
  note: MessageSquare,
  contact: Phone,
  follow_up: CircleDot,
}

export function ApplicationTimeline({ application }: { application: Application }) {
  const addEvent = useApplicationsStore((state) => state.addEvent)
  const [note, setNote] = useState('')
  const [contact, setContact] = useState('')

  const events = [...application.events].sort((a, b) => b.at.localeCompare(a.at))

  const logNote = () => {
    if (!note.trim()) return
    addEvent(application.id, makeEvent('note', nowIso(), { text: note.trim() }))
    setNote('')
  }
  const logContact = () => {
    if (!contact.trim()) return
    addEvent(application.id, makeEvent('contact', nowIso(), { text: contact.trim() }))
    setContact('')
  }

  return (
    <Card className="space-y-4">
      <SectionLabel>Timeline</SectionLabel>

      <div className="space-y-2">
        <div className="flex gap-2">
          <Input
            value={note}
            placeholder="Log a note…"
            onChange={(e) => setNote(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && logNote()}
          />
          <Button type="button" variant="subtle" onClick={logNote} disabled={!note.trim()}>
            Add
          </Button>
        </div>
        <div className="flex gap-2">
          <Input
            value={contact}
            placeholder="Log a contact (call, email)…"
            onChange={(e) => setContact(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && logContact()}
          />
          <Button type="button" variant="subtle" onClick={logContact} disabled={!contact.trim()}>
            Add
          </Button>
        </div>
      </div>

      <ol className="space-y-3">
        {events.map((event) => {
          const Icon = KIND_ICON[event.kind]
          return (
            <li key={event.id} className="flex gap-3">
              <Icon size={16} className="text-muted shrink-0 mt-0.5" aria-hidden />
              <div className="min-w-0">
                <div className="text-sm text-ink-2">{describe(event)}</div>
                <div className="text-xs text-faint">
                  {formatDate(event.at)} · {formatRelative(event.at)}
                </div>
              </div>
            </li>
          )
        })}
      </ol>
    </Card>
  )
}

function describe(event: ApplicationEvent): string {
  switch (event.kind) {
    case 'created':
      return 'Application created'
    case 'stage_change':
      return `Moved ${event.fromStage ? APPLICATION_STAGE_LABELS[event.fromStage] : '—'} → ${
        event.toStage ? APPLICATION_STAGE_LABELS[event.toStage] : '—'
      }`
    case 'contact':
      return `Contact: ${event.text ?? ''}`
    case 'follow_up':
      return `Follow-up: ${event.text ?? ''}`
    case 'note':
    default:
      return event.text ?? ''
  }
}
