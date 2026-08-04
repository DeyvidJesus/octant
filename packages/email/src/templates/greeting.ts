/**
 * Greeting and pluralisation helpers.
 *
 * Trivial on their own, but 14 templates each inlining `name ? \`Hi ${name},\` : 'Hi there,'` is 14
 * chances to word it differently. Centralising also means a blank-but-present name (`"  "`) degrades to
 * the neutral greeting instead of rendering "Hi ,".
 */

/** `Hi Ana,` when a usable name exists, otherwise `Hi there,`. */
export function greetingFor(name?: string): string {
  const trimmed = name?.trim()
  return trimmed !== undefined && trimmed !== '' ? `Hi ${trimmed},` : 'Hi there,'
}

/** `1 day` / `3 days`. Avoids the "1 days" bug appearing in one template but not the others. */
export function pluralize(count: number, singular: string, plural = `${singular}s`): string {
  return `${count} ${Math.abs(count) === 1 ? singular : plural}`
}

/** Renders an expiry sentence, or nothing when the caller didn't supply a window. */
export function expiryNote(minutes?: number): string | undefined {
  if (minutes === undefined || minutes <= 0) return undefined
  if (minutes % 60 === 0) return `This link expires in ${pluralize(minutes / 60, 'hour')}.`
  return `This link expires in ${pluralize(minutes, 'minute')}.`
}
