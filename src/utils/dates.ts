export function nowIso(): string {
  return new Date().toISOString()
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString()
}

/** ISO timestamp → `YYYY-MM-DD` for a native `<input type="date">`. */
export function toDateInput(iso?: string): string {
  if (!iso) return ''
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''
  return date.toISOString().slice(0, 10)
}

/** `YYYY-MM-DD` from a date input → ISO timestamp (midnight UTC), or undefined. */
export function fromDateInput(value: string): string | undefined {
  if (!value) return undefined
  const date = new Date(`${value}T00:00:00.000Z`)
  if (Number.isNaN(date.getTime())) return undefined
  return date.toISOString()
}

const DAY_MS = 24 * 60 * 60 * 1000

/** Whole-day difference between `iso` and `reference` (positive = future). */
function dayDelta(iso: string, reference: Date): number {
  const target = new Date(iso)
  if (Number.isNaN(target.getTime())) return 0
  const startOf = (d: Date) => Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())
  return Math.round((startOf(target) - startOf(reference)) / DAY_MS)
}

/** Human relative label, e.g. "today", "in 3d", "2d ago". */
export function formatRelative(iso: string, reference: Date = new Date()): string {
  const delta = dayDelta(iso, reference)
  if (delta === 0) return 'today'
  if (delta > 0) return `in ${delta}d`
  return `${Math.abs(delta)}d ago`
}

/** True when `iso` is a date strictly before today. */
export function isOverdue(iso?: string, reference: Date = new Date()): boolean {
  if (!iso) return false
  return dayDelta(iso, reference) < 0
}

/** True when `iso` is today or earlier (i.e. a follow-up that is due). */
export function isDue(iso?: string, reference: Date = new Date()): boolean {
  if (!iso) return false
  return dayDelta(iso, reference) <= 0
}
