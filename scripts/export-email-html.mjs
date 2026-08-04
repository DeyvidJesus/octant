// Renders every template to static HTML + text under `.email-preview/`.
//
// Two uses:
//   * Reviewing the real output without starting the dev server, and pasting a rendered file into a
//     client-compatibility checker (Litmus, Email on Acid) or into the Supabase dashboard's auth
//     templates as a manual fallback.
//   * A cheap sanity pass: if any template throws, this exits non-zero.
//
// It renders from the SAME fixtures the tests and the dev-server preview use, so the exported files can
// never disagree with what the suite asserts.
//
// The package is TypeScript/TSX, so it needs compiling before Node can import it. We reuse `esbuild`
// (already a devDependency, and already the tool behind `bundle-functions.mjs`) rather than adding a
// TypeScript loader just for this script.
//
// Run:  yarn email:export

import * as esbuild from 'esbuild'
import fs from 'node:fs/promises'
import path from 'node:path'
import { pathToFileURL, fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const outDir = path.join(root, '.email-preview')

/** Entry point compiled on the fly: pulls the renderer and the shared fixtures into one module. */
const ENTRY = `
export { TEMPLATE_NAMES, renderTemplate } from '${path.join(root, 'packages/email/src/index.ts').replace(/\\/g, '/')}'
export { templateFixtures } from '${path.join(root, 'packages/email/src/templates/fixtures.ts').replace(/\\/g, '/')}'
export { previewBrand } from '${path.join(root, 'packages/email/src/templates/preview.ts').replace(/\\/g, '/')}'
`

// Inside the repo, not the OS temp dir: the bundle keeps `@react-email/render` and friends external, so
// it has to sit somewhere Node's resolver can walk up to `node_modules`. `node_modules/.tmp` is already
// where the tsconfigs put their build info.
const tempDir = path.join(root, 'node_modules/.tmp')
const bundlePath = path.join(tempDir, 'octant-email-render.mjs')
await fs.mkdir(tempDir, { recursive: true })

try {
  await esbuild.build({
    stdin: { contents: ENTRY, resolveDir: root, loader: 'ts' },
    outfile: bundlePath,
    bundle: true,
    format: 'esm',
    platform: 'node',
    target: 'node20',
    jsx: 'automatic',
    jsxImportSource: 'react',
    // Leave the runtime deps to Node's own resolution — notably `@react-email/render`, whose package
    // exports pick the correct build per environment.
    packages: 'external',
    logLevel: 'warning',
  })

  const { TEMPLATE_NAMES, renderTemplate, templateFixtures, previewBrand } = await import(
    pathToFileURL(bundlePath).href
  )

  await fs.rm(outDir, { recursive: true, force: true })
  await fs.mkdir(outDir, { recursive: true })

  const index = []
  for (const name of TEMPLATE_NAMES) {
    const { subject, html, text } = await renderTemplate(name, templateFixtures[name], previewBrand)
    await fs.writeFile(path.join(outDir, `${name}.html`), html, 'utf8')
    await fs.writeFile(path.join(outDir, `${name}.txt`), text, 'utf8')
    index.push({ name, subject })
    console.log(`✓ ${name}  —  ${subject}`)
  }

  await fs.writeFile(path.join(outDir, 'index.json'), `${JSON.stringify(index, null, 2)}\n`, 'utf8')
  console.log(`\n${index.length} templates written to ${path.relative(root, outDir)}/`)
} finally {
  // Remove only our own artefact — `node_modules/.tmp` is shared with the TypeScript build info.
  await fs.rm(bundlePath, { force: true })
}
