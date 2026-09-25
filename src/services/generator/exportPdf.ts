import type { TailoredResume } from '@/types/generator'
import { supabase } from '@/services/supabase/client'

/** Same-project Edge Function that renders the ATS-standardized PDF server-side. */
const EXPORT_PDF_URL = `${import.meta.env.VITE_SUPABASE_URL ?? ''}/functions/v1/export-pdf`

/** Strips characters that are unsafe in a download filename. */
function safeFilename(name: string): string {
  return name.replace(/[/\\?%*:|"<>]+/g, '-').trim() || 'resume'
}

/** Renders server-side so the PDF doesn't vary by browser or OS, then triggers a download. Needs a session. */
export async function exportResumePdf(tailored: TailoredResume, filename: string): Promise<void> {
  const { data: { session } } = await supabase.auth.getSession()
  const token = session?.access_token
  if (!token) throw new Error('You must be signed in to export a PDF.')

  const response = await fetch(EXPORT_PDF_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
    body: JSON.stringify(tailored),
  })

  if (!response.ok) {
    let detail = ''
    try {
      detail = ((await response.json()) as { error?: string })?.error ?? ''
    } catch {
      // non-JSON error body — keep the status-only message
    }
    throw new Error(`PDF export failed (HTTP ${response.status}). ${detail}`.trim())
  }

  const blob = await response.blob()
  const url = URL.createObjectURL(blob)
  try {
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `${safeFilename(filename)}.pdf`
    document.body.appendChild(anchor)
    anchor.click()
    anchor.remove()
  } finally {
    URL.revokeObjectURL(url)
  }
}
