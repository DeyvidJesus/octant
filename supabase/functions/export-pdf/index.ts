// Supabase Edge Function: export-pdf
//
// Phase 9 — Serverless PDF Export (ATS Safety). Client-side "Save as PDF" (window.print) produced
// output that varied by browser/OS, risking ATS misparsing. This function renders a tailored resume
// to a PDF server-side from ONE strictly standardized, ATS-optimized HTML/CSS template, so every
// download is byte-for-byte consistent and machine-parseable.
//
// Runtime note: Supabase Edge Functions run on Deno isolates, which cannot launch a bundled
// Chromium. We therefore drive a REMOTE headless browser over the DevTools protocol via
// puppeteer-core `connect()`. Provision any browserless-compatible endpoint and set:
//   supabase secrets set BROWSER_PDF_WS_ENDPOINT="wss://chrome.browserless.io?token=..."
// (SUPABASE_URL / SUPABASE_ANON_KEY are injected automatically.)
//
// Deploy: supabase functions deploy export-pdf

import puppeteer from 'npm:puppeteer-core@22.15.0'
import { createClient } from 'jsr:@supabase/supabase-js@2'

interface LabeledLink { label: string; url: string }
interface TailoredBullet { text: string; metric?: string; included: boolean }
interface TailoredHeader {
  name: string
  role: string
  location: string
  email?: string
  phone?: string
  links: LabeledLink[]
}
interface TailoredSkillGroup { category: string; skills: Array<{ canonical: string; matched: boolean }> }
interface TailoredExperience { company: string; role: string; duration: string; location?: string; bullets: TailoredBullet[] }
interface TailoredProject { name: string; tech: string[]; url?: string; description: string; included: boolean; bullets: TailoredBullet[] }
interface TailoredEducation { institution: string; degree: string; field: string; period?: string }
interface TailoredCertification { name: string; issuer: string }
interface TailoredLanguage { name: string; level: string }
interface TailoredResume {
  header: TailoredHeader
  summary: string
  skillGroups: TailoredSkillGroup[]
  experience: TailoredExperience[]
  projects: TailoredProject[]
  education: TailoredEducation[]
  certifications: TailoredCertification[]
  languages: TailoredLanguage[]
}

const CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, content-type',
}

function jsonError(message: string, status: number): Response {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { ...CORS_HEADERS, 'content-type': 'application/json' },
  })
}

/** Escapes text so user content can never break the template markup. */
function esc(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function bulletHtml(bullets: TailoredBullet[]): string {
  const included = bullets.filter((bullet) => bullet.included)
  if (included.length === 0) return ''
  const items = included
    .map((bullet) => `<li>${esc(bullet.text)}${bullet.metric ? ` (${esc(bullet.metric)})` : ''}</li>`)
    .join('')
  return `<ul>${items}</ul>`
}

/**
 * Builds the single ATS-optimized document. Rules: one column, standard system sans-serif, real
 * selectable text, no tables/columns/images/icons, recognizable section headings in a conventional
 * order, plain bullet lists. Inclusion/ordering mirror the text exporters (excluded content is
 * omitted) so the PDF matches what the user curated in the preview.
 */
function buildAtsHtml(resume: TailoredResume): string {
  const { header } = resume
  const sections: string[] = []

  const contact = [
    header.email,
    header.phone,
    ...header.links.map((link) => `${link.label}: ${link.url}`),
  ].filter((value): value is string => Boolean(value && value.trim()))

  const headerHtml = `
    <header>
      <h1>${esc(header.name)}</h1>
      <p class="role">${[header.role, header.location].filter(Boolean).map(esc).join(' | ')}</p>
      ${contact.length ? `<p class="contact">${contact.map(esc).join(' | ')}</p>` : ''}
    </header>`

  if (resume.summary.trim()) {
    sections.push(`<section><h2>Summary</h2><p>${esc(resume.summary.trim())}</p></section>`)
  }

  if (resume.skillGroups.length) {
    const groups = resume.skillGroups
      .map((group) => `<p><strong>${esc(group.category)}:</strong> ${group.skills.map((skill) => esc(skill.canonical)).join(', ')}</p>`)
      .join('')
    sections.push(`<section><h2>Skills</h2>${groups}</section>`)
  }

  const experiences = resume.experience.filter((entry) => entry.bullets.some((bullet) => bullet.included))
  if (experiences.length) {
    const entries = experiences
      .map((entry) => {
        const meta = [entry.duration, entry.location].filter(Boolean).map(esc).join(' | ')
        return `<div class="entry"><h3>${esc(entry.role)} — ${esc(entry.company)}</h3>${meta ? `<p class="meta">${meta}</p>` : ''}${bulletHtml(entry.bullets)}</div>`
      })
      .join('')
    sections.push(`<section><h2>Experience</h2>${entries}</section>`)
  }

  const projects = resume.projects.filter((project) => project.included)
  if (projects.length) {
    const entries = projects
      .map((project) => {
        const tech = project.tech.length ? `<p class="meta">${project.tech.map(esc).join(', ')}</p>` : ''
        const url = project.url ? `<p class="meta">${esc(project.url)}</p>` : ''
        const description = project.description.trim() ? `<p>${esc(project.description.trim())}</p>` : ''
        return `<div class="entry"><h3>${esc(project.name)}</h3>${tech}${url}${description}${bulletHtml(project.bullets)}</div>`
      })
      .join('')
    sections.push(`<section><h2>Projects</h2>${entries}</section>`)
  }

  if (resume.education.length) {
    const entries = resume.education
      .map((entry) => `<li>${esc(entry.degree)} in ${esc(entry.field)}, ${esc(entry.institution)}${entry.period ? ` (${esc(entry.period)})` : ''}</li>`)
      .join('')
    sections.push(`<section><h2>Education</h2><ul>${entries}</ul></section>`)
  }

  if (resume.certifications.length) {
    const entries = resume.certifications
      .map((cert) => `<li>${esc(cert.name)} — ${esc(cert.issuer)}</li>`)
      .join('')
    sections.push(`<section><h2>Certifications</h2><ul>${entries}</ul></section>`)
  }

  if (resume.languages.length) {
    const languages = resume.languages.map((language) => `${esc(language.name)} (${esc(language.level)})`).join(' | ')
    sections.push(`<section><h2>Languages</h2><p>${languages}</p></section>`)
  }

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    font-family: Arial, Helvetica, sans-serif;
    font-size: 10.5pt;
    line-height: 1.35;
    color: #000;
    background: #fff;
    -webkit-print-color-adjust: exact;
  }
  header { margin-bottom: 14px; }
  h1 { font-size: 20pt; font-weight: bold; letter-spacing: 0.2px; }
  .role { font-size: 11pt; margin-top: 2px; }
  .contact { font-size: 9.5pt; margin-top: 3px; }
  section { margin-top: 14px; }
  h2 {
    font-size: 11pt;
    font-weight: bold;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    border-bottom: 1px solid #000;
    padding-bottom: 2px;
    margin-bottom: 6px;
  }
  h3 { font-size: 10.5pt; font-weight: bold; margin-top: 8px; }
  .entry:first-child h3 { margin-top: 0; }
  .meta { font-size: 9.5pt; font-style: italic; margin-bottom: 2px; }
  ul { list-style: disc; padding-left: 18px; margin-top: 3px; }
  li { margin-bottom: 2px; }
  p { margin-bottom: 2px; }
  section p + p { margin-top: 3px; }
</style>
</head>
<body>
  ${headerHtml}
  ${sections.join('\n')}
</body>
</html>`
}

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS })
  if (req.method !== 'POST') return jsonError('Method not allowed.', 405)

  // 1. Verify the caller's Supabase JWT.
  const authHeader = req.headers.get('Authorization')
  if (!authHeader) return jsonError('Missing authorization header.', 401)
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_ANON_KEY') ?? '',
    { global: { headers: { Authorization: authHeader } }, auth: { persistSession: false } },
  )
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return jsonError('Invalid or expired session.', 401)

  // 2. Parse + minimally validate the TailoredResume payload.
  let resume: TailoredResume
  try {
    resume = await req.json()
  } catch {
    return jsonError('Invalid JSON body.', 400)
  }
  if (!resume?.header?.name || !Array.isArray(resume.experience)) {
    return jsonError('Payload is not a TailoredResume.', 400)
  }

  const endpoint = Deno.env.get('BROWSER_PDF_WS_ENDPOINT')
  if (!endpoint) return jsonError('Server is missing BROWSER_PDF_WS_ENDPOINT.', 500)

  // 3. Render the standardized template to PDF via the remote headless browser.
  const html = buildAtsHtml(resume)
  let pdf: Uint8Array
  const browser = await puppeteer.connect({ browserWSEndpoint: endpoint })
  try {
    const page = await browser.newPage()
    await page.setContent(html, { waitUntil: 'networkidle0' })
    pdf = await page.pdf({
      format: 'Letter',
      printBackground: false,
      margin: { top: '0.5in', bottom: '0.5in', left: '0.6in', right: '0.6in' },
    })
    await page.close()
  } catch (err) {
    return jsonError(`Could not render the PDF. ${String(err)}`.trim(), 502)
  } finally {
    // Disconnect (don't close) — the remote browser session is managed by the provider.
    await browser.disconnect()
  }

  // 4. Return the binary.
  const safeName = (resume.header.name || 'resume').replace(/[^\w.-]+/g, '_')
  return new Response(pdf, {
    status: 200,
    headers: {
      ...CORS_HEADERS,
      'content-type': 'application/pdf',
      'content-disposition': `attachment; filename="${safeName}.pdf"`,
    },
  })
})
