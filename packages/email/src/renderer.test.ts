// Invariants checked for every registered template; snapshots are avoided on purpose.

import { describe, expect, it } from 'vitest'
import { renderTemplate } from './renderer.ts'
import { TEMPLATE_NAMES, templateRegistry } from './registry.ts'
import { templateFixtures } from './templates/fixtures.ts'
import { previewBrand } from './templates/preview.ts'
import type { TemplateName } from './templates/props.ts'

/** Renders a template from its shared fixture. */
function renderFixture(name: TemplateName) {
  return renderTemplate(name, templateFixtures[name], previewBrand)
}

describe('template registry', () => {
  it('registers exactly the 14 declared templates', () => {
    expect(TEMPLATE_NAMES).toHaveLength(14)
    expect(new Set(TEMPLATE_NAMES).size).toBe(14)
  })

  it('has a fixture for every registered template', () => {
    for (const name of TEMPLATE_NAMES) {
      expect(templateFixtures[name], `missing fixture for "${name}"`).toBeDefined()
    }
  })

  it('has a component and a subject builder for every template', () => {
    for (const name of TEMPLATE_NAMES) {
      expect(templateRegistry[name].component, `missing component for "${name}"`).toBeTypeOf('function')
      expect(templateRegistry[name].subject, `missing subject for "${name}"`).toBeTypeOf('function')
    }
  })

  it('marks every current template as critical — none may silently become opt-out', () => {
    for (const name of TEMPLATE_NAMES) {
      expect(templateRegistry[name].critical, `"${name}" is not critical`).toBe(true)
    }
  })
})

describe.each(TEMPLATE_NAMES)('%s', (name) => {
  it('renders non-empty HTML and plain text', async () => {
    const { html, text } = await renderFixture(name)
    expect(html.length).toBeGreaterThan(500)
    expect(text.trim().length).toBeGreaterThan(80)
  })

  it('produces a usable subject', async () => {
    const { subject } = await renderFixture(name)
    expect(subject.trim()).not.toBe('')
    // Subjects are header values, not markup, and long ones get truncated in every inbox.
    expect(subject).not.toContain('<')
    expect(subject.length).toBeLessThanOrEqual(78)
  })

  it('never leaks a missing value into the output', async () => {
    const { html, text, subject } = await renderFixture(name)
    for (const [label, content] of [
      ['html', html],
      ['text', text],
      ['subject', subject],
    ] as const) {
      expect(content, `"undefined" leaked into ${label}`).not.toContain('undefined')
      expect(content, `"NaN" leaked into ${label}`).not.toContain('NaN')
      expect(content, `"[object Object]" leaked into ${label}`).not.toContain('[object Object]')
    }
  })

  it('is a complete HTML document with a preview snippet', async () => {
    const { html } = await renderFixture(name)
    expect(html).toContain('<!DOCTYPE html')
    expect(html).toContain('</html>')
    // <Preview> renders as a hidden div; without it clients show body boilerplate as the snippet.
    expect(html).toMatch(/display:\s*none/)
  })

  it('declares dark mode explicitly so clients do not force-invert the palette', async () => {
    const { html } = await renderFixture(name)
    expect(html).toContain('color-scheme')
    expect(html).toContain('#0a0a0a')
  })

  it('carries the brand identity and support contact', async () => {
    const { html, text } = await renderFixture(name)
    expect(html).toContain('Octant')
    expect(text).toContain('support@useoctant.com')
  })

  it('contains only absolute links — a relative href is dead in an email client', async () => {
    const { html } = await renderFixture(name)
    const hrefs = [...html.matchAll(/href="([^"]+)"/g)].map((match) => match[1])
    expect(hrefs.length).toBeGreaterThan(0)
    for (const href of hrefs) {
      expect(href, `relative href "${href}"`).toMatch(/^(https?:|mailto:)/)
    }
  })

  it('renders label/value tables as readable rows in plain text', async () => {
    const { text } = await renderFixture(name)
    // Without the renderer's dataTable formatter, InfoTable labels and values run together.
    expect(text).not.toContain('Knowledge BaseAdd')
  })

  it('omits the decorative logo tile from the plain-text part', async () => {
    const { text } = await renderFixture(name)
    // Otherwise every text part opens with a bare "O" from the tile.
    expect(text.trimStart().startsWith('O\n')).toBe(false)
  })
})
