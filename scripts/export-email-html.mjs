// Renders every email template from the test fixtures to HTML and text in .email-preview/. Run: yarn email:export
// Compiles the TSX package with esbuild first; exits non-zero if any template throws.

import * as esbuild from 'esbuild'
import fs from 'node:fs/promises'
import path from 'node:path'
import { pathToFileURL, fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const outDir = path.join(root, '.email-preview')

// Virtual entry that re-exports the renderer and fixtures.
const ENTRY = `
export { TEMPLATE_NAMES, renderTemplate } from '${path.join(root, 'packages/email/src/index.ts').replace(/\\/g, '/')}'
export { templateFixtures } from '${path.join(root, 'packages/email/src/templates/fixtures.ts').replace(/\\/g, '/')}'
export { previewBrand } from '${path.join(root, 'packages/email/src/templates/preview.ts').replace(/\\/g, '/')}'
`

// Inside the repo, not the OS temp dir, so Node can resolve the external packages from node_modules.
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
    // Let Node resolve deps so @react-email/render picks its Node build.
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
  // node_modules/.tmp also holds TypeScript build info, so remove only our file.
  await fs.rm(bundlePath, { force: true })
}
