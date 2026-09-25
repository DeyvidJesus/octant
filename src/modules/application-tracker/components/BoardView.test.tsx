// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import type { Application, ApplicationStage } from '@/types/application'
import { useApplicationsStore } from '@/stores/applicationsStore'
import { BoardView } from './BoardView'

function makeApplication(id: string, company: string, stage: ApplicationStage): Application {
  const at = '2026-09-01T00:00:00.000Z'
  return {
    id,
    company,
    role: 'Frontend Engineer',
    workMode: 'remote',
    stage,
    createdAt: at,
    updatedAt: at,
    links: [],
    notes: '',
    events: [],
  } as Application
}

const moveStage = vi.fn()

beforeEach(() => {
  // BoardView reads `moveStage` from the store; swap in a spy so no persistence runs.
  useApplicationsStore.setState({ moveStage })
})

afterEach(() => {
  cleanup()
  moveStage.mockReset()
})

function renderBoard(applications: Application[]) {
  return render(
    <MemoryRouter>
      <BoardView applications={applications} />
    </MemoryRouter>,
  )
}

/** The card whose accessible name starts with the company. */
function card(company: string): HTMLElement {
  return screen.getByRole('button', { name: new RegExp(`^${company} —`) })
}

describe('BoardView keyboard moves', () => {
  it('ArrowRight moves a card to the next column’s primary stage', () => {
    renderBoard([makeApplication('a1', 'Acme', 'saved')])
    fireEvent.keyDown(card('Acme'), { key: 'ArrowRight' })
    expect(moveStage).toHaveBeenCalledWith('a1', 'applied')
  })

  it('ArrowLeft moves a card back one column', () => {
    renderBoard([makeApplication('a1', 'Acme', 'screening')])
    fireEvent.keyDown(card('Acme'), { key: 'ArrowLeft' })
    expect(moveStage).toHaveBeenCalledWith('a1', 'applied')
  })

  it('does nothing past the edges of the board', () => {
    renderBoard([makeApplication('a1', 'First', 'saved'), makeApplication('a2', 'Last', 'rejected')])
    fireEvent.keyDown(card('First'), { key: 'ArrowLeft' })
    fireEvent.keyDown(card('Last'), { key: 'ArrowRight' })
    expect(moveStage).not.toHaveBeenCalled()
  })

  it('tells screen-reader users how to move a card', () => {
    renderBoard([makeApplication('a1', 'Acme', 'applied')])
    expect(card('Acme')).toHaveAccessibleName(/use left and right arrow keys to change stage/)
  })
})

describe('BoardView columns and drag and drop', () => {
  it('groups every terminal stage under Closed', () => {
    renderBoard([makeApplication('a1', 'Rejected Co', 'rejected'), makeApplication('a2', 'Ghost Co', 'ghosted')])
    const closed = screen.getByText('Closed').parentElement!.parentElement!
    expect(within(closed).getByText('Rejected Co')).toBeInTheDocument()
    expect(within(closed).getByText('Ghost Co')).toBeInTheDocument()
    expect(within(closed).getByText('2')).toBeInTheDocument()
  })

  it('dropping a card on a column moves it to that column’s primary stage', () => {
    renderBoard([makeApplication('a1', 'Acme', 'saved')])
    const screening = screen.getByText('Screening').parentElement!.parentElement!
    fireEvent.drop(screening, { dataTransfer: { getData: () => 'a1' } })
    expect(moveStage).toHaveBeenCalledWith('a1', 'screening')
  })
})
