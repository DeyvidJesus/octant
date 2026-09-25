// Bundles each Edge Function's worker.ts/handler.ts into the deployed index.ts. Run: yarn build:functions
// Deno cannot resolve the extensionless `@/` imports or the `@octant/email` workspace name, so they are inlined.

import * as esbuild from 'esbuild'
import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const functionsDir = path.join(root, 'supabase/functions')
const rootPkgPath = path.join(root, 'package.json')

// `entry` is the hand-edited source; the generated index.ts next to it is what gets deployed.
const TARGETS = [
  { name: 'discovery-worker', entry: 'worker.ts' },
  { name: 'auth-email-hook', entry: 'handler.ts' },
  { name: 'send-email', entry: 'handler.ts' },
  { name: 'resend-webhook', entry: 'handler.ts' },
  { name: 'stripe-webhook', entry: 'handler.ts' },
]

// Rewritten to `npm:` URLs so Deno picks the edge build (e.g. @react-email/render's `deno` export).
// esbuild matches specifiers, not packages, so subpaths like react-dom/server are listed separately.
const EXTERNAL_NPM = [
  'resend',
  'react',
  'react/jsx-runtime',
  'react-dom',
  'react-dom/server',
  'standardwebhooks',
  '@react-email/components',
  '@react-email/render',
]

// 'react/jsx-runtime' -> { packageName: 'react', subpath: '/jsx-runtime' }; handles scoped packages.
function splitNpmSpecifier(specifier) {
  const segments = specifier.split('/')
  const nameSegments = specifier.startsWith('@') ? segments.slice(0, 2) : segments.slice(0, 1)
  const packageName = nameSegments.join('/')
  const subpath = segments.slice(nameSegments.length).join('/')
  return { packageName, subpath: subpath === '' ? '' : `/${subpath}` }
}

// Versions come from the root package.json so there is one place to bump them.
async function resolveNpmVersions() {
  const manifest = JSON.parse(await fs.readFile(rootPkgPath, 'utf8'))
  const declared = { ...manifest.dependencies, ...manifest.devDependencies }

  const versions = new Map()
  for (const specifier of EXTERNAL_NPM) {
    // `react-dom/server` inherits the version declared for `react-dom`.
    const { packageName } = splitNpmSpecifier(specifier)
    const range = declared[packageName]
    if (range === undefined) {
      throw new Error(
        `scripts/bundle-functions.mjs: "${packageName}" is external but not declared in package.json.`,
      )
    }
    // Deno accepts ranges like `npm:pkg@^1.2.3`.
    versions.set(specifier, range)
  }
  return versions
}

// Emits `npm:<name>@<version><subpath>`; Deno rejects the version after a subpath (npm:react/jsx-runtime@^19).
function npmExternalPlugin(versions) {
  return {
    name: 'npm-external',
    setup(build) {
      const pattern = new RegExp(
        `^(${EXTERNAL_NPM.map((name) => name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})$`,
      )
      build.onResolve({ filter: pattern }, (args) => {
        const { packageName, subpath } = splitNpmSpecifier(args.path)
        return {
          path: `npm:${packageName}@${versions.get(args.path)}${subpath}`,
          external: true,
        }
      })
    },
  }
}

// Checks every emitted `npm:` specifier here, since a malformed one otherwise only fails at deploy time.
async function assertDenoSpecifiers(outfile, functionName) {
  const emitted = await fs.readFile(outfile, 'utf8')
  const specifiers = [...emitted.matchAll(/from\s*"(npm:[^"]+)"/g)].map((match) => match[1])

  for (const specifier of new Set(specifiers)) {
    const body = specifier.slice('npm:'.length)
    const isScoped = body.startsWith('@')
    // Drop the scope's `@` so the only `@` left is the version separator.
    const searchable = isScoped ? body.slice(1) : body
    const at = searchable.indexOf('@')
    if (at === -1) {
      throw new Error(
        `${functionName}: "${specifier}" has no version requirement. Add the package to package.json and to EXTERNAL_NPM.`,
      )
    }
    // Only the package name may precede the version.
    const beforeVersion = searchable.slice(0, at)
    const nameSegments = beforeVersion.split('/')
    const expectedSegments = isScoped ? 2 : 1
    if (nameSegments.length !== expectedSegments) {
      const suggestion = `npm:${nameSegments.slice(0, expectedSegments).join('/')}@<version>/${nameSegments
        .slice(expectedSegments)
        .join('/')}`
      throw new Error(
        `${functionName}: "${specifier}" puts the version after a subpath, which Deno rejects. Expected the shape "${suggestion}".`,
      )
    }
  }
  return specifiers.length
}

async function bundle(target, versions) {
  const fnDir = path.join(functionsDir, target.name)
  const entry = path.join(fnDir, target.entry)
  const outfile = path.join(fnDir, 'index.ts')

  await esbuild.build({
    entryPoints: [entry],
    outfile,
    bundle: true,
    format: 'esm',
    platform: 'neutral',
    target: 'esnext',
    jsx: 'automatic',
    jsxImportSource: 'react',
    // Runtime-provided specifiers stay external; everything else is inlined.
    external: ['jsr:*', 'npm:*', 'node:*', 'https://*'],
    alias: {
      '@': path.join(root, 'src'),
      '@octant/email': path.join(root, 'packages/email/src/index.ts'),
    },
    plugins: [npmExternalPlugin(versions)],
    legalComments: 'none',
    banner: {
      js: `// GENERATED by scripts/bundle-functions.mjs — DO NOT EDIT. Edit ${target.entry} and run \`yarn build:functions\`.`,
    },
    logLevel: 'warning',
  })

  const npmImports = await assertDenoSpecifiers(outfile, target.name)
  const { size } = await fs.stat(outfile)
  console.log(`✓ ${target.name}/index.ts  (${(size / 1024).toFixed(1)} kB, ${npmImports} npm imports)`)
}

const versions = await resolveNpmVersions()
for (const target of TARGETS) {
  await bundle(target, versions)
}
console.log(`\nBundled ${TARGETS.length} Edge Functions. Deploy them with \`supabase functions deploy <name>\`.`)
