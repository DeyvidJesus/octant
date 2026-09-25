# Octant — Runbook de Produção (Go-Live)

Guia único e ordenado para colocar todo o projeto no ar, **incluindo as 5 fases do agente de descoberta**. Complementa o [DEPLOY.md](../DEPLOY.md) (base do app) com o passo a passo completo: quais chaves, onde obter, onde subir, e a ordem que faz tudo fluir.

## 0. Arquitetura em produção

```
[ Browser ] ──HTTPS──> [ Netlify: SPA Vite/React ]
     │                         │ (VITE_* públicas, embutidas no bundle)
     │  Supabase JS (JWT)      │
     ▼                         ▼
[ Supabase ] Postgres + Auth + RLS + Realtime + Edge Functions (Deno)
     │   Edge Functions (segredos server-side): ai-proxy,
     │   discovery-worker, stripe-webhook, create-checkout/portal, get-plan-pricing, export-pdf
     ▼
[ Provedores ]  Gemini (busca+estratégia+worker) · OpenAI (reasoning padrão) · Stripe · PostHog · Sentry
     ▲
[ Scheduler externo ] (GitHub Actions / Inngest / pg_cron) ──x-discovery-secret──> discovery-worker
```

Regras de ouro:
- **`VITE_*` é público** (vai no bundle). Nunca coloque segredo com prefixo `VITE_`.
- **Segredos de servidor vivem só no Supabase** (`supabase secrets set`) — nunca no `.env` do frontend nem na Netlify.
- O gatilho do agente é só um **endpoint HTTP**; o agendador é trocável e mora fora do código.

---

## 1. Pré-requisitos (contas)

Supabase, Netlify (ou similar), Google AI Studio (Gemini). Opcionais: OpenAI, Stripe, PostHog, Sentry. Ferramentas locais: Node 20.19+ ou 22.12+ (o repo roda em 22, mas o Vite pede 22.12+ — alinhe para evitar `--ignore-engines`), `supabase` CLI, `git`.

---

## 2. Matriz de chaves e segredos

### 2.1 Frontend (Netlify → Site settings → Environment variables) — PÚBLICAS
| Variável | Obrigatória | Onde obter |
|---|---|---|
| `VITE_SUPABASE_URL` | ✅ | Supabase › Project Settings › API › Project URL |
| `VITE_SUPABASE_ANON_KEY` | ✅ | Supabase › Project Settings › API › `anon`/publishable key |
| `VITE_POSTHOG_KEY` / `VITE_POSTHOG_HOST` | ⬜ | PostHog › Project Settings (host default `https://us.i.posthog.com`) |
| `VITE_SENTRY_DSN` | ⬜ | Sentry › Project › Client Keys (DSN) |
| `VITE_DEMO_SEED` | ⬜ | **Deixe ausente/`false` em produção** (só `true` para demо com a persona) |

> ⚠️ O client faz **fail-fast em build de produção** se `VITE_SUPABASE_URL`/`VITE_SUPABASE_ANON_KEY` faltarem ([client.ts](../src/services/supabase/client.ts)). Não use os prefixos `NEXT_PUBLIC_*` (o Vite ignora).

### 2.2 Supabase Edge Functions (`supabase secrets set`) — SERVIDOR
| Segredo | Usado por | Obrigatório | Onde obter |
|---|---|---|---|
| `GEMINI_API_KEY` | discovery-worker, ai-proxy (gemini) | ✅ (descoberta) | [aistudio.google.com/apikey](https://aistudio.google.com/apikey) |
| `OPENAI_API_KEY` | ai-proxy (provider padrão `gpt-4o`) | ✅ (reasoning) | [platform.openai.com/api-keys](https://platform.openai.com/api-keys) |
| `ANTHROPIC_API_KEY` | ai-proxy (claude) | ⬜ | [console.anthropic.com](https://console.anthropic.com/settings/keys) |
| `OPENROUTER_API_KEY` | ai-proxy (openrouter) | ⬜ | [openrouter.ai/keys](https://openrouter.ai/keys) |
| `DISCOVERY_CRON_SECRET` | discovery-worker (modo agendado) | ✅ (agente offline) | gere: `openssl rand -hex 32` |
| `ALLOWED_ORIGINS` | CORS de todas as functions | ✅ recomendado | a URL do app (ex.: `https://seu-app.netlify.app`) |
| `APP_URL` | billing (redirects) + fallback de CORS | ✅ (billing) | a URL do app |
| `STRIPE_SECRET_KEY` | billing + webhook | ⬜ (se billing) | Stripe › Developers › API keys (`sk_...`) |
| `STRIPE_WEBHOOK_SECRET` | stripe-webhook | ⬜ (se billing) | Stripe › Webhooks › signing secret (`whsec_...`) |
| `STRIPE_PRICE_ID` | checkout + pricing | ⬜ (se billing) | Stripe › Products › Price (`price_...`) |
| `FREE_TIER_MONTHLY_TOKEN_LIMIT` | ai-proxy + discovery-worker | ⬜ | teto mensal do Free (default `100000`; `0` = ilimitado) |
| `PRO_TIER_MONTHLY_TOKEN_LIMIT` | ai-proxy + discovery-worker | ⬜ | teto mensal do Pro (default `2000000`; `0` = ilimitado) |
| `BROWSER_PDF_WS_ENDPOINT` | export-pdf | ⬜ | endpoint WS do Chromium headless (ex.: Browserless) |
| `RESEND_API_KEY` | auth-email-hook, send-email, resend-webhook, stripe-webhook | ✅ (email) | Resend › API Keys (`re_...`, com *Sending access*) |
| `EMAIL_FROM` | idem | ✅ (email) | remetente num domínio **verificado** no Resend (ex.: `Octant <noreply@useoctant.com>`) |
| `EMAIL_SUPPORT` | idem | ⬜ | endereço mostrado no rodapé (default `support@useoctant.com`) |
| `EMAIL_APP_NAME` / `EMAIL_LOCALE` | idem | ⬜ | nome do produto (default `Octant`) e locale de datas/valores (default `en-US`) |
| `SEND_EMAIL_HOOK_SECRET` | auth-email-hook | ✅ (email de auth) | Supabase › Authentication › Hooks › Send Email (`v1,whsec_...`) |
| `RESEND_WEBHOOK_SECRET` | resend-webhook | ✅ (status de entrega) | Resend › Webhooks › endpoint (`whsec_...`) |
| `BILLING_PLAN_NAME` / `BILLING_GRACE_PERIOD_DAYS` | stripe-webhook | ⬜ | texto dos emails de billing (defaults `Pro` / `7`) |

> `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` são **injetados automaticamente** nas Edge Functions — **não** os configure como secret.

### 2.3 Scheduler (GitHub Actions → repo Settings › Secrets)
`SUPABASE_URL` (o `https://<ref>.supabase.co`) e `DISCOVERY_CRON_SECRET` (o mesmo valor do secret do Supabase).

### 🔒 Segurança obrigatória antes do go-live
- **Rotacione a chave Gemini** que foi exposta no bundle antigo (`AQ.Ab8RN6…`) — ela é pública. Gere uma nova no Google AI Studio e restrinja por API/domínio.
- Rotacione quaisquer `STRIPE_*`/`SUPABASE_SECRET` que já circularam fora do cofre.

---

## 3. Passo a passo

### A) Supabase — banco, auth, realtime
1. Crie o projeto; copie **Project URL** e **anon key** (Project Settings › API).
2. **Aplique o schema.** Fonte de verdade: [`supabase-schema.sql`](../supabase-schema.sql) (consolidado — já inclui as tabelas de descoberta das Fases 1–4).
   - **Projeto novo:** SQL Editor → cole `supabase-schema.sql` → Run; depois rode todas as migrations em ordem (são idempotentes). É exatamente o caminho que `supabase/tests` executa no CI.
   - **Projeto existente:** cole no SQL Editor, em ordem, as migrations que ainda não rodaram (as mais recentes: `0015`, `0016`, `0017`, `0018`). Todas são **idempotentes**.
   - **Cuidado com `supabase db push`:** ele só sabe o que já rodou pela tabela `supabase_migrations.schema_migrations`. Se as migrations foram aplicadas pelo SQL Editor, esse histórico está vazio e o `db push` tentaria rodar tudo desde a `0001`. Nesse caso, registre as já aplicadas antes (`supabase migration repair --status applied 0001 0002 …`) ou use o SQL Editor.
   - **Ordem do deploy:** migrations **antes** das Edge Functions. O `stripe-webhook` atual chama `apply_subscription_event` (0018) e responde 500 se ela não existir; o Stripe reentrega o evento depois, então nada se perde, mas o plano atrasa.
   - **Conferir as checagens de JSONB (0017):** se alguma constraint ficou `NOT VALID` por causa de linhas antigas, ela aparece em `select conrelid::regclass, conname from pg_constraint where conname like '%\_data\_shape' and not convalidated;`. Escritas novas já são checadas; depois de corrigir as linhas, rode `alter table <tabela> validate constraint <nome>`.
3. **Auth:** Authentication › Providers → habilite **Email**. (Confirme a política de confirmação de email conforme sua preferência.)
4. **Realtime:** garanta que Realtime está ligado no projeto (padrão no Supabase). As migrations já adicionam `discovered_jobs` e `discovery_runs` à publicação `supabase_realtime` com `replica identity full` — é o que faz o **feed incremental** (Fase 1) chegar sozinho.
5. **RLS:** confirme (Table Editor) que todas as tabelas mostram RLS habilitado. O schema já define as policies `auth.uid() = user_id`.

### B) Provedores de IA
1. **Gemini** (obrigatória p/ descoberta): crie a chave no AI Studio.
2. **OpenAI** (reasoning padrão): o app usa `openai/gpt-4o` como provedor de raciocínio (Recruiter Read, Interview Coach, extração de currículo no onboarding, explicação de compatibilidade no client). Crie a chave.
3. Anthropic/OpenRouter são opcionais (só se você quiser oferecer esses modelos).

### C) Stripe (billing — opcional)
1. Products → crie o produto **Pro** e uma **Price** recorrente → copie o `price_...` (→ `STRIPE_PRICE_ID`).
2. Developers › API keys → copie o `sk_...` (→ `STRIPE_SECRET_KEY`).
3. Developers › Webhooks → **Add endpoint**: `https://<ref>.supabase.co/functions/v1/stripe-webhook`; eventos `customer.subscription.created/updated/deleted`, `customer.subscription.trial_will_end`, `invoice.payment_succeeded` e `invoice.payment_failed` → copie o signing secret (→ `STRIPE_WEBHOOK_SECRET`).
   - Os três primeiros definem o tier; os três últimos são o que dispara os emails de billing (recibo, falha de pagamento, fim de trial). Sem habilitá-los, esses emails simplesmente nunca saem — a lista canônica é `BILLING_EVENT_TYPES` em `packages/email/src/integrations/stripeBilling.ts`.
4. Settings › Billing › Customer portal → **ative** o portal.

### D) Subir os segredos (Supabase CLI)
```bash
supabase login
supabase link --project-ref <SEU_PROJECT_REF>

supabase secrets set \
  GEMINI_API_KEY=... \
  OPENAI_API_KEY=... \
  DISCOVERY_CRON_SECRET=$(openssl rand -hex 32) \
  ALLOWED_ORIGINS=https://seu-app.netlify.app \
  APP_URL=https://seu-app.netlify.app
# opcionais / billing:
supabase secrets set STRIPE_SECRET_KEY=sk_... STRIPE_WEBHOOK_SECRET=whsec_... STRIPE_PRICE_ID=price_...
supabase secrets set FREE_TIER_MONTHLY_TOKEN_LIMIT=100000
# email (Fase 15) — sem RESEND_API_KEY toda a camada de email vira no-op silencioso:
supabase secrets set \
  RESEND_API_KEY=re_... \
  EMAIL_FROM="Octant <noreply@useoctant.com>" \
  EMAIL_SUPPORT=support@useoctant.com \
  SEND_EMAIL_HOOK_SECRET='v1,whsec_...' \
  RESEND_WEBHOOK_SECRET=whsec_...
```

### E) Deploy das Edge Functions

> **Atalho:** `yarn deploy:functions` regenera os bundles e publica todas as funções com a flag de JWT
> certa ([scripts/deploy-functions.sh](../scripts/deploy-functions.sh)). `yarn deploy:functions ai-proxy`
> publica só as nomeadas. Os comandos abaixo são o que ele executa.

```bash
supabase functions deploy ai-proxy
# O worker é chamado pelo scheduler via header `x-discovery-secret` (não um JWT do Supabase); ele
# valida a segurança por dentro, então precisa de --no-verify-jwt (mesmo padrão do stripe-webhook):
supabase functions deploy discovery-worker --no-verify-jwt
supabase functions deploy create-checkout-session
supabase functions deploy create-portal-session
supabase functions deploy get-plan-pricing
supabase functions deploy export-pdf
# O webhook do Stripe NÃO recebe JWT do Supabase:
supabase functions deploy stripe-webhook --no-verify-jwt
# Email (Fase 15). O hook do Auth e o webhook do Resend também não recebem JWT do Supabase —
# ambos autenticam por assinatura (Standard Webhooks) dentro da própria função:
supabase functions deploy auth-email-hook --no-verify-jwt
supabase functions deploy resend-webhook --no-verify-jwt
# Este é chamado pelo browser com o JWT do usuário, então a verificação fica LIGADA:
supabase functions deploy send-email
```
> ⚠️ **Cinco funções são empacotadas (bundle) antes do deploy:** `discovery-worker`, `auth-email-hook`,
> `send-email`, `resend-webhook` e `stripe-webhook`. O edge-runtime da Supabase (Deno) NÃO resolve
> imports sem extensão em runtime, nem o alias interno `@octant/email`, então essas funções
> reusam o núcleo puro do `src/` e o pacote de email via um bundle de arquivo único. A fonte editável é
> `worker.ts` / `handler.ts`; o `esbuild` inlina tudo em `index.ts` (o entry deployado, gerado — não
> edite à mão), deixando externos só os specifiers `jsr:`/`npm:`.
>
> As dependências npm do pacote de email ficam **externas** de propósito: o `@react-email/render`
> declara uma condição de export `deno` que aponta para um build edge-safe (usa `react-dom/server.browser`).
> Inlinar traria o build de Node e quebraria no isolate.
>
> **Sempre rode `yarn build:functions` depois de editar qualquer `worker.ts` / `handler.ts` (ou o núcleo
> em `src/` ou `packages/email/`) e antes do deploy:**
> ```bash
> yarn build:functions   # regenera os cinco index.ts
> supabase functions deploy <nome> [--no-verify-jwt]
> ```

### F) Frontend na Netlify
1. Netlify → **Add new site › Import from Git** → selecione o repo. Build já vem do [`netlify.toml`](../netlify.toml) (`yarn build`, publish `dist`, SPA fallback).
2. Site settings › Environment variables → adicione as **`VITE_*`** da seção 2.1.
3. Deploy. O `tsc -b && vite build` roda; se faltar `VITE_SUPABASE_*`, o build de produção **falha de propósito** (fail-fast) — corrija as envs e refaça.

### G) Scheduler do agente (Fase 2 — coleta offline)
Crie `.github/workflows/discovery-tick.yml` (o worker seleciona sozinho os usuários "due" por cadência de plano — free 24h / pro 1h):
```yaml
name: discovery-tick
on:
  schedule: [{ cron: '0 * * * *' }]   # de hora em hora
  workflow_dispatch: {}
jobs:
  tick:
    runs-on: ubuntu-latest
    steps:
      - run: |
          curl -fsS -X POST "$SUPABASE_URL/functions/v1/discovery-worker" \
            -H "x-discovery-secret: $DISCOVERY_CRON_SECRET" \
            -H "content-type: application/json" -d '{}'
        env:
          SUPABASE_URL: ${{ secrets.SUPABASE_URL }}
          DISCOVERY_CRON_SECRET: ${{ secrets.DISCOVERY_CRON_SECRET }}
```
Alternativas equivalentes (só mudam "quem chama o endpoint"): **pg_cron + pg_net** (`select net.http_post(...)`), **Trigger.dev**, **Inngest**.

---

## 4. Como cada fase "acende" em produção

- **Fase 1 (Fundação):** com o schema aplicado + realtime, o feed em `/jobs/discovery` já transmite candidatos incrementalmente e mostra o status do agente. Perfil de busca estruturado em **Settings**.
- **Fase 2 (Agente):** com `discovery-worker` deployado + `DISCOVERY_CRON_SECRET` + scheduler, o banco de oportunidades é mantido **mesmo com o usuário offline**; e o **heartbeat de sessão** dispara um run quando o app abre e o usuário está "due".
- **Fase 3 (Inteligência):** com `GEMINI_API_KEY` (busca/estratégia) e `OPENAI_API_KEY` (explicação), os top-K candidatos ganham explicação + lacunas + recomendação; o resto tem "Explain fit" sob demanda.
- **Fase 4 (Aprendizado):** aprovar/dispensar gera sinais → re-rank do feed + viés nas estratégias, automaticamente.
- **Fase 5 (Agente de carreira):** badge de "novas" no menu, digest no header e toast quando o agente acha algo em background.

---

## 5. Verificação (smoke tests, na ordem)

1. **Auth:** criar conta / login funciona; refresh mantém a sessão.
2. **DB + RLS + realtime:** adicionar um job manual persiste após refresh.
3. **Onboarding:** colar um currículo → "Import with AI" popula a Knowledge Base (exige `OPENAI_API_KEY`).
4. **Descoberta (in-session):** em `/jobs/discovery`, **"Run now"** → `discovery_runs` transita `running → succeeded`, candidatos **entram no feed por streaming**, ranqueados por score; top-K com recomendação/explicação.
5. **Aprendizado:** dispensar um candidato de uma empresa e aprovar outro; rodar de novo → o ranking/estratégias refletem as preferências.
6. **Agente offline:** dispare o workflow (`workflow_dispatch`) ou aguarde o cron → novos candidatos aparecem sem ninguém clicar; toast "seu agente encontrou N…".
7. **Billing (se configurado):** Settings mostra o preço; upgrade abre o Stripe; ao concluir em test mode, `subscriptions.tier` vira `pro`; "Manage subscription" abre o portal.
8. **Observabilidade:** um evento aparece no PostHog; um erro forçado aparece no Sentry.

---

## 6. Custo e governança
- **Teto por usuário/mês:** Free `FREE_TIER_MONTHLY_TOKEN_LIMIT` (default 100k) e Pro `PRO_TIER_MONTHLY_TOKEN_LIMIT` (default 2M); `0` em qualquer um = ilimitado. Vale no `ai-proxy` e no `discovery-worker`.
- **Cadência:** free 24h / pro 1h ([cadence.ts](../src/services/discovery/cadence.ts)); ajuste os números se o custo real pedir. O cron pode rodar de hora em hora sem problema — o worker só processa quem está "due".
- **Monitoramento:** a tabela `discovery_runs` é o log (status, `stats`, `tokens_used`); `token_usage_logs` soma o consumo por usuário/mês. Comece **conservador** (cron 1×/dia) e aumente observando essas tabelas.
- **Deep Research** foi removido: a função `deep-research` não tinha chamador no app nem orçamento de tokens. Se ela ainda estiver publicada no projeto, apague com `supabase functions delete deep-research`.

## 7. Troubleshooting
| Sintoma | Causa provável | Correção |
|---|---|---|
| Scheduler/curl → **404** no `discovery-worker` | função **não deployada** nesse projeto | `supabase functions deploy discovery-worker --no-verify-jwt`; confira com `supabase functions list` |
| Scheduler → **401** (worker existe) | deployado **sem** `--no-verify-jwt` (o gateway barra o header de secret) | redeploy com `--no-verify-jwt` |
| `discovery-worker` → **503** + log `worker boot error: Module not found: .../pipeline` | deployado a fonte com imports `@/` sem extensão (edge-runtime não resolve) | rode `yarn build:functions` (gera o bundle) e redeploy — o entry `index.ts` é o bundle, não a fonte |
| Build Netlify passa mas auth falha | `VITE_SUPABASE_*` ausentes/mal nomeadas | Use os nomes exatos `VITE_...`; refaça o deploy |
| Feed não atualiza sozinho | Realtime off ou tabelas fora da publicação | Verifique Realtime no projeto; reaplique `0011` |
| `discovery-worker` 500 "missing GEMINI_API_KEY" | secret não setado | `supabase secrets set GEMINI_API_KEY=...` |
| Deploy do worker falha em import `@/...` | edge-runtime sem sloppy-imports | Use o **fallback** da seção E |
| Chamadas de IA 401 | JWT ausente/expirado | O usuário precisa estar logado (o proxy exige JWT) |
| CORS bloqueando | `ALLOWED_ORIGINS`/`APP_URL` errados | Aponte para a URL exata do app |
| Webhook Stripe 400 | deployado sem `--no-verify-jwt` ou secret errado | Redeploy com a flag; confira `STRIPE_WEBHOOK_SECRET` |
