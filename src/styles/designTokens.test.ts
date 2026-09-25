import { describe, expect, it } from 'vitest'

/**
 * Guards the design system: UI code styles with semantic tokens (`text-danger`, `bg-inverse`,
 * `text-ink-strong`…) defined in index.css, never with raw palette classes. A raw `text-red-400` or
 * `bg-white` would silently drift from the theme, so this fails the suite instead.
 */

const sources = import.meta.glob<string>('/src/{app,components,modules}/**/*.tsx', {
  query: '?raw',
  import: 'default',
  eager: true,
})

/** The printed resume sheet is deliberately grayscale on white paper, independent of the app theme. */
const EXEMPT = new Set(['/src/modules/resume-generator/components/ResumePaper.tsx'])

const RAW_PALETTE =
  /\b(?:bg|text|border|outline|ring|accent|decoration|fill|stroke)-(?:white|black|(?:red|emerald|amber|indigo|green|blue|yellow|gray|sky|violet|rose|orange)-\d{2,3})\b/g

describe('design tokens', () => {
  it('finds UI sources to check', () => {
    expect(Object.keys(sources).length).toBeGreaterThan(50)
  })

  it('UI code uses semantic color tokens, not raw palette classes', () => {
    const offenders = Object.entries(sources)
      .filter(([path]) => !EXEMPT.has(path) && !path.endsWith('.test.tsx'))
      .flatMap(([path, source]) => [...source.matchAll(RAW_PALETTE)].map((match) => `${path}: ${match[0]}`))
    expect(offenders).toEqual([])
  })
})
