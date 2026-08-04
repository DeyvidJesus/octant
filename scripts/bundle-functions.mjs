// Bundles Edge Functions that share TypeScript with the rest of the repo into self-contained modules.
//
// WHY THIS EXISTS: the Supabase edge-runtime (Deno) does NOT honor `sloppy-imports` at runtime, so it
// can't resolve the extensionless `@/...` imports the shared `src/` core uses, nor the bare
// `@octant/email` workspace specifier (Deno has no node_modules resolution for workspace names). We keep
// ONE source of truth per function (`worker.ts` / `handler.ts`) and bundle it here into the deployed
// `index.ts`: all local/pure code is inlined, and only Deno-native specifiers stay external.
//
// The npm dependencies of the email module are NOT inlined. They are rewritten to pinned `npm:` URLs so
// Deno resolves them itself, which matters most for `@react-email/render`: its package exports declare a
// dedicated `deno` condition pointing at an edge-safe build that uses `react-dom/server.browser`.
// Inlining it would instead bake in the Node build and pull in Node-only internals. Versions are read
// from the root package.json, so there is one place to bump them.
//
// Run:  yarn build:functions
// Then: supabase functions deploy <name> [--no-verify-jwt]

import * as esbuild from 'esbuild'
import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const functionsDir = path.join(root, 'supabase/functions')
const rootPkgPath = path.join(root, 'package.json')

/**
 * One entry per bundled function. `entry` is the hand-edited source; `out` is the generated file that
 * `supabase functions deploy` actually uploads.
 */
const TARGETS = [
  { name: 'discovery-worker', entry: 'worker.ts' },
  { name: 'auth-email-hook', entry: 'handler.ts' },
  { name: 'send-email', entry: 'handler.ts' },
  { name: 'resend-webhook', entry: 'handler.ts' },
  { name: 'stripe-webhook', entry: 'handler.ts' },
]

/**
 * Bare npm specifiers that must stay external, resolved by Deno rather than inlined.
 *
 * `react-dom/server` is listed explicitly (not just `react-dom`) because `@react-email/render` imports
 * the subpath directly, and esbuild matches specifiers, not packages.
 */
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

/**
 * Splits a bare specifier into its package name and its subpath, handling scoped packages.
 *
 *   react/jsx-runtime        -> { packageName: 'react',                   subpath: '/jsx-runtime' }
 *   react-dom/server         -> { packageName: 'react-dom',               subpath: '/server' }
 *   @react-email/components  -> { packageName: '@react-email/components', subpath: '' }
 */
function splitNpmSpecifier(specifier) {
  const segments = specifier.split('/')
  const nameSegments = specifier.startsWith('@') ? segments.slice(0, 2) : segments.slice(0, 1)
  const packageName = nameSegments.join('/')
  const subpath = segments.slice(nameSegments.length).join('/')
  return { packageName, subpath: subpath === '' ? '' : `/${subpath}` }
}

/** Reads the pinned version for each external specifier from the root package.json. */
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
    // Keep the declared range — Deno accepts `npm:pkg@^1.2.3`.
    versions.set(specifier, range)
  }
  return versions
}

/**
 * Rewrites bare npm specifiers to `npm:<name>@<version><subpath>` and marks them external, so the emitted
 * module imports exactly what Deno can resolve. Without this the bundler would try to inline
 * `react-dom/server`.
 *
 * The version goes after the PACKAGE NAME, not at the end of the specifier: Deno rejects
 * `npm:react/jsx-runtime@^19.2.7` ("Invalid package specifier") and wants
 * `npm:react@^19.2.7/jsx-runtime`. Getting this wrong only surfaces at `supabase functions deploy`
 * time, so `assertDenoSpecifiers` below checks every emitted bundle instead of trusting it.
 */
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

/**
 * Validates every `npm:` specifier the bundle emits, so a malformed one fails HERE rather than at
 * `supabase functions deploy` time — which is a slow, remote, and much less obvious place to find out.
 *
 * Deno requires the version to sit on the package name: `npm:react@^19/jsx-runtime`, never
 * `npm:react/jsx-runtime@^19`. It also requires a version on anything we pin at all.
 */
async function assertDenoSpecifiers(outfile, functionName) {
  const emitted = await fs.readFile(outfile, 'utf8')
  const specifiers = [...emitted.matchAll(/from\s*"(npm:[^"]+)"/g)].map((match) => match[1])

  for (const specifier of new Set(specifiers)) {
    const body = specifier.slice('npm:'.length)
    const isScoped = body.startsWith('@')
    // Strip the leading `@` of a scope so the version `@` is the only one we look for.
    const searchable = isScoped ? body.slice(1) : body
    const at = searchable.indexOf('@')
    if (at === -1) {
      throw new Error(
        `${functionName}: "${specifier}" has no version requirement. Add the package to package.json and to EXTERNAL_NPM.`,
      )
    }
    // Everything before the version must be the bare package name — no slash may precede it.
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
    // React Email templates are TSX; the automatic runtime avoids needing a JSX pragma per file.
    jsx: 'automatic',
    jsxImportSource: 'react',
    // Leave the runtime-provided specifiers alone; inline everything else (our pure `src/` core and the
    // email package's own modules).
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
