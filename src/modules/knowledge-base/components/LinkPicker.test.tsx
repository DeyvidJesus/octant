// @vitest-environment happy-dom
import { useState } from 'react'
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { createEmptyKnowledgeBase } from '@/constants/emptyKnowledgeBase'
import { emptyFact } from '@/services/knowledge/classify'
import { projectKnowledgeBase } from '@/services/resume/projection'
import { LinkPicker, type LinkOption } from './LinkPicker'

const OPTIONS: LinkOption[] = [
  { id: 'r1', label: 'Frontend Engineer · Acme' },
  { id: 'r2', label: 'Tech Lead · Globex' },
]

function Harness({ initial = [] as string[] }) {
  const [selected, setSelected] = useState(initial)
  return (
    <>
      <LinkPicker label="Appears under roles" options={OPTIONS} selected={selected} onChange={setSelected} emptyHint="none" />
      <output>{selected.join(',')}</output>
    </>
  )
}

afterEach(cleanup)

describe('LinkPicker', () => {
  it('toggles links on and off and exposes the state with aria-pressed', () => {
    render(<Harness initial={['r2']} />)
    const acme = screen.getByRole('button', { name: 'Frontend Engineer · Acme' })
    expect(acme).toHaveAttribute('aria-pressed', 'false')
    fireEvent.click(acme)
    expect(acme).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('status')).toHaveTextContent('r2,r1')
    fireEvent.click(screen.getByRole('button', { name: 'Tech Lead · Globex' }))
    expect(screen.getByRole('status')).toHaveTextContent('r1')
  })

  it('groups the buttons under its label', () => {
    render(<Harness />)
    expect(screen.getByRole('group', { name: 'Appears under roles' })).toBeInTheDocument()
  })

  it('shows the hint when there is nothing to link to', () => {
    render(<LinkPicker label="Roles" options={[]} selected={[]} onChange={() => {}} emptyHint="Add a role first." />)
    expect(screen.getByText('Add a role first.')).toBeInTheDocument()
    expect(screen.queryByRole('group')).toBeNull()
  })
})

describe('why the links matter', () => {
  it('a confirmed fact reaches the resume only when it is linked to a role', () => {
    const kb = createEmptyKnowledgeBase()
    kb.organizations = [{ id: 'o1', name: 'Acme', type: 'employer', provenance: { source: 'manual', excerpt: '' } }]
    kb.roles = [{ id: 'r1', organizationId: 'o1', title: 'Engineer', period: '2024', provenance: { source: 'manual', excerpt: '' } }]
    const linked = { ...emptyFact(), statement: 'Cut LCP by 40%', status: 'confirmed' as const, roleIds: ['r1'] }
    const loose = { ...emptyFact(), statement: 'Mentored two juniors', status: 'confirmed' as const }
    kb.facts = [linked, loose]

    const bullets = projectKnowledgeBase(kb).experience[0].accomplishments.map((a) => a.text)
    expect(bullets).toEqual(['Cut LCP by 40%'])
  })
})
