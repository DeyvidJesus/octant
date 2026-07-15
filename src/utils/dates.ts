export function nowIso(): string {
  return new Date().toISOString()
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString()
}
