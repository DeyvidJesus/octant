# `@octant/email`

Transactional email for Octant: React Email templates, one typed service, one place that talks to Resend.

**This is an internal module, not a published package and not a workspace.** It has no `package.json` of
its own — its dependencies are declared in the root manifest, and `@octant/email` is simply a path alias
resolved in two places:

| Consumer | Where the alias lives |
|---|---|
| vitest | `resolve.alias` in [`vitest.config.ts`](../../vitest.config.ts) |
| Edge Function bundles | `alias` in [`scripts/bundle-functions.mjs`](../../scripts/bundle-functions.mjs) |

`tsc -b` typechecks this directory through the project reference in the root
[`tsconfig.json`](../../tsconfig.json), using [`./tsconfig.json`](./tsconfig.json). It needs no alias:
everything inside `src` imports relatively, and the only files using `@octant/email` are the Edge Function
handlers, which no tsconfig includes.

The alias is deliberately **absent** from `tsconfig.app.json`, so the app cannot resolve
`@octant/email` even if someone tries to import it — the boundary below is mechanical, not a convention.

**This module is server-only.** It must never be imported from `src/` — it pulls in the Resend SDK and
`react-dom/server`, and shipping either to the browser would bloat the bundle and put an API key one
careless `VITE_` prefix away from being public. The app triggers email through the `send-email` Edge
Function instead (`src/services/email/notifications.ts`).

Its npm dependencies (`resend`, `@react-email/*`, `standardwebhooks`, `react-email`) live in the root
**`devDependencies`**: nothing in the shipped client bundle imports them, and the deployed Edge Functions
resolve them at runtime via `npm:` specifiers rather than from `node_modules`. They are needed only for
`tsc -b`, the tests, and the esbuild bundling step.

## Layout

```
src/
  index.ts          public barrel — the only import path consumers use
  EmailService.ts   the facade: 14 send methods, one send path
  registry.ts       template name -> { subject, component }
  renderer.ts       React element -> { subject, html, text }
  config.ts         env -> EmailConfig (injected env reader, no direct process/Deno access)
  errors.ts         typed error hierarchy
  formatting.ts     money/date formatting for props
  transport/
    EmailTransport.ts     ports: send, suppressions, webhook verification
    ResendTransport.ts    the ONLY file that imports `resend`
    InMemoryTransport.ts  test double / no-op used when unconfigured
    retry.ts              pure backoff + jitter, injected clock
  integrations/
    supabaseAuth.ts   Auth hook payload -> template (pure, tested)
    stripeBilling.ts  Stripe event -> template (pure, tested)
  brand/              colors, fonts, link builders
  templates/
    props.ts          the 14 props interfaces + TemplateDefinitions (the contract)
    fixtures.ts       sample props — shared by previews, tests and the HTML export
    layouts/          BaseLayout, Header, Footer
    components/       Button, Callout, InfoTable, TokenBlock, Divider, Logo, typography
    transactional/    the 14 templates
```

## Why it's shaped this way

**One send path.** Every `send*` method delegates to a private `dispatch` that renders, builds the
idempotency key, retries and logs. Adding a template does not touch delivery mechanics.

**The registry is the contract.** `TemplateDefinitions` in `templates/props.ts` maps each name to its
props; `registry.ts` is typed as `Record<TemplateName, …>` over it. A template with no component, or
props with no template, is a compile error — not a runtime surprise.

**Ports and adapters.** `EmailService` depends on `EmailTransport` and `EmailConfig`, never on Resend.
Swapping providers means adding a file in `transport/`, not editing call sites.

**Logging is plain `console` with an `[email]` prefix**, matching `src/repositories/persist.ts` and the
Zustand stores. There is deliberately no logger abstraction: this code runs in Deno Edge Functions, where
`console` output already lands in the Supabase function logs, so a port would add indirection and buy
nothing. Tests assert on the log lines by spying on `console`.

**Pure where it matters.** `supabase/functions/**` is outside the vitest suite, so provider payload
mapping, retry maths and formatting all live here rather than in an Edge Function. The functions keep
only what needs a runtime: signature verification, HTTP, database writes.

**No enums, no parameter properties.** The tsconfig sets `erasableSyntaxOnly`, matching the app. Unions
are `as const` objects; `EmailService` assigns its fields in the constructor body.

## Conventions worth knowing

- **Imports carry explicit `.ts` / `.tsx` extensions**, unlike `src/`. This package is bundled for Deno,
  and extensionless specifiers are exactly what the edge runtime cannot resolve — see the comment at the
  top of `scripts/bundle-functions.mjs`.
- **Templates take pre-formatted strings** for dates and money. Locale decisions belong at the call site;
  `formatting.ts` provides the helpers.
- **Every template ships HTML *and* plain text**, both generated from the same React tree, so they cannot
  drift. An HTML-only transactional email scores worse for spam and arrives blank through gateways that
  strip HTML.
- **Dark-mode-safe styling.** Hex literals only (email clients strip CSS variables), an explicit
  background on every surface (otherwise Gmail's dark-mode transform inverts it into mud), and a real
  `width` alongside `maxWidth` (Outlook's Word engine ignores `max-width`).

## Working on templates

```bash
yarn email:dev      # React Email dev server; live preview of all 14 from templates/fixtures.ts
yarn email:export   # renders every template to .email-preview/*.html and *.txt
yarn test           # includes this package (vitest include covers packages/*/src)
```

`renderer.test.ts` asserts invariants over **every** registered template — non-empty HTML and text, a
usable subject, no leaked `undefined`/`NaN`, absolute links only, dark-mode declared. It loops over
`TEMPLATE_NAMES`, so a new template is covered the moment it's registered.

## Adding a template

1. Add its props interface and a `TemplateDefinitions` entry in `templates/props.ts`.
2. Create the component in `templates/transactional/`, wrapped in `BaseLayout`, with a named
   `withPreview(...)` default export carrying sample props.
3. Register it in `registry.ts` with a subject builder.
4. Add its fixture to `templates/fixtures.ts`.
5. Add a `send*` method on `EmailService` (four lines, delegating to `dispatch`).

TypeScript will tell you if you skip 1, 3 or 4; the tests will tell you if the result doesn't render.

## Configuration

All from the environment, nothing hardcoded. See the EMAIL section of `.env.example`. With
`RESEND_API_KEY` unset the service composes an in-memory transport and every send returns
`{ skipped: true }` — dev and CI never send, and nothing throws.
