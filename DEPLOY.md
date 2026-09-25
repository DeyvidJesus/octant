# Guia de Deploy — Octant

> **Atenção:** o runbook atual é [docs/PRODUCTION.md](docs/PRODUCTION.md). Este guia é anterior às
> funções de email e ao agente de descoberta (fala em 4–6 funções e migrations até 0008). Em um projeto
> novo, aplique **todas** as migrations em `supabase/migrations/` depois do `supabase-schema.sql`: o
> schema consolidado não inclui as tabelas de email (0014) nem as migrations seguintes.

Este documento lista **tudo** que você precisa provisionar e configurar para colocar o Octant em produção, partindo apenas do código (nenhum serviço externo criado ainda).

Nada aqui é executado automaticamente — é um passo a passo para você seguir.

> **Fonte de verdade do schema:** use **`supabase-schema.sql`** (na raiz). O arquivo `SUPABASE_SETUP.md` está **desatualizado** (descreve um schema antigo baseado em blobs — `generators`, `interview_preps`) e **não deve ser usado**.

---

## 0. Visão geral da arquitetura

```
┌─────────────────┐     HTTPS      ┌───────────────────────────────────────┐
│  Frontend (SPA) │ ─────────────▶ │  Supabase                             │
│  Vite + React   │                │  • Postgres (DB + RLS)                │
│  hospedado na   │                │  • Auth (email/senha)                 │
│  Netlify        │                │  • 4 Edge Functions (Deno):           │
└─────────────────┘                │      ai-proxy                         │
        │                          │      create-checkout-session          │
        │ (chamada direta)         │      stripe-webhook                   │
        ▼                          │      export-pdf                       │
   Google Gemini                   └───────────────────────────────────────┘
   (Deep Research)                       │         │          │
                                         ▼         ▼          ▼
                                     OpenAI     Stripe    browserless
                                                          (Chrome remoto)
```

Duas superfícies com ambientes **separados**:

- **Frontend** — variáveis com prefixo `VITE_` (públicas, embutidas no bundle). Configuradas no `.env` local e no painel da Netlify.
- **Backend (Edge Functions)** — secrets privados via `supabase secrets set`. Nunca vão para o cliente.

### Ferramentas locais que você precisa instalar
- **Node ≥ 20** e **Yarn** (o repo usa `yarn@1.22.22`).
- **Supabase CLI** (`npm i -g supabase`) — para deploy das functions e secrets.
- **Stripe CLI** (opcional) — para testar o webhook localmente.
- **Git** + uma conta no GitHub/GitLab (a Netlify puxa o repo daí).

### Contas que você precisa criar
| Serviço | Para quê | Obrigatório? |
|---|---|---|
| **Supabase** | DB, Auth, Edge Functions | ✅ Essencial |
| **Netlify** | Hospedar o frontend | ✅ Essencial |
| **OpenAI** | Provider de IA default | ✅ Essencial (features de IA) |
| **Google AI Studio (Gemini)** | Feature Deep Research | ⬜ Opcional |
| **Stripe** | Assinatura Pro (billing) | ⬜ Opcional |
| **browserless.io** (ou similar) | Export de PDF | ⬜ Opcional |
| **PostHog** | Analytics | ⬜ Opcional |
| **Sentry** | Monitoramento de erros | ⬜ Opcional |

---

## 1. Sanity check local (antes de deployar)

```bash
yarn install
# crie um .env na raiz com pelo menos:
#   VITE_SUPABASE_URL=...
#   VITE_SUPABASE_ANON_KEY=...
yarn dev        # abre em http://localhost:5173
yarn build      # tsc -b && vite build — TEM que passar antes do deploy
yarn test       # opcional (vitest)
yarn lint       # opcional (oxlint)
```

Se o `yarn build` falhar, corrija antes de continuar — a Netlify roda exatamente esse comando.

---

## 2. Provisionar o Supabase ✅ ESSENCIAL

1. **Crie o projeto** no [dashboard do Supabase](https://supabase.com/dashboard).
2. Em **Settings → API**, anote:
   - **Project URL** (ex.: `https://xxxx.supabase.co`)
   - **anon / public key**
   - **service_role key** (secreta — nunca vá para o frontend)
3. **Aplique o schema**: abra o **SQL Editor**, cole o conteúdo de [`supabase-schema.sql`](supabase-schema.sql) e execute.
   - Alternativa via CLI: `supabase db push` aplicando as migrations em [`supabase/migrations/`](supabase/migrations/) (`0001`–`0008`).
   - Os dois caminhos são equivalentes e idempotentes. Para projeto novo, rodar `supabase-schema.sql` é o mais direto.
4. **Auth**: em **Authentication → Providers**, habilite **Email** (é o único provider usado — o app faz `signInWithPassword`, sem OAuth). Decida:
   - "Confirm email" ligado/desligado.
   - Configure **SMTP** próprio para produção (o SMTP default do Supabase é limitado).
5. **Confirme RLS**: em **Database → Tables**, verifique que **Row Level Security está ativo em todas as tabelas** (já vem no schema, mas confirme).
6. **Linke o CLI** ao projeto (necessário para functions/secrets):
   ```bash
   supabase login
   supabase link --project-ref <PROJECT_REF>
   ```

### O que o schema cria (resumo)
`jobs`, `applications`, `job_analyses`, `resumes` + tabelas normalizadas (`resume_organizations`, `resume_roles`, `resume_skills`, `resume_facts`), `discovered_jobs`, `tailored_resumes` (1 linha por `user_id`+`job_id`), tabelas de entrevista (`user_skills`, `mock_interviews`, `mock_answers`), `subscriptions` e `token_usage_logs`. Realtime habilitado em `jobs`/`applications`. Limites do tier free são aplicados **por RLS** (funções `within_job_limit` = 3 jobs, `within_tailored_resume_limit` = 1 tailored resume).

---

## 3. Deploy das Edge Functions ✅ ESSENCIAL (para IA)

São 6 functions. Atenção ao flag de JWT de cada uma:

```bash
supabase functions deploy ai-proxy                        # JWT ON (default)
supabase functions deploy create-checkout-session         # JWT ON (default)
supabase functions deploy stripe-webhook --no-verify-jwt  # ⚠️ JWT OFF — obrigatório
supabase functions deploy export-pdf                      # JWT ON (default)
supabase functions deploy get-plan-pricing                # JWT ON — mostra o preço ao vivo (billing)
supabase functions deploy create-portal-session           # JWT ON — Customer Portal (billing)
```

> ⚠️ O `stripe-webhook` **precisa** de `--no-verify-jwt` porque a Stripe não envia um JWT do Supabase — a autenticidade é verificada pela assinatura do webhook.

As variáveis `SUPABASE_URL`, `SUPABASE_ANON_KEY` e `SUPABASE_SERVICE_ROLE_KEY` são **injetadas automaticamente** pelo runtime das Edge Functions — **não** as configure como secret.

---

## 4. Secrets das Edge Functions

Configure via `supabase secrets set NOME=valor`. Referências: [`ai-proxy`](supabase/functions/ai-proxy/index.ts), [`create-checkout-session`](supabase/functions/create-checkout-session/index.ts), [`stripe-webhook`](supabase/functions/stripe-webhook/index.ts), [`export-pdf`](supabase/functions/export-pdf/index.ts).

| Secret | Consumido por | Obrigatório? |
|---|---|---|
| `OPENAI_API_KEY` | ai-proxy | ✅ Sim (provider default) |
| `ANTHROPIC_API_KEY` | ai-proxy | ⬜ Só se oferecer Claude |
| `OPENROUTER_API_KEY` | ai-proxy | ⬜ Só se oferecer OpenRouter |
| `FREE_TIER_MONTHLY_TOKEN_LIMIT` | ai-proxy | ⬜ Opcional (`0`/ausente = nunca bloqueia, só loga) |
| `STRIPE_SECRET_KEY` | create-checkout-session, stripe-webhook, get-plan-pricing, create-portal-session | ⬜ Só se usar billing |
| `STRIPE_PRICE_ID` | create-checkout-session, get-plan-pricing | ⬜ Só se usar billing |
| `APP_URL` | create-checkout-session, create-portal-session | ⬜ Só se usar billing |
| `STRIPE_WEBHOOK_SECRET` | stripe-webhook | ⬜ Só se usar billing |
| `BROWSER_PDF_WS_ENDPOINT` | export-pdf | ⬜ Só se usar export PDF |

Exemplo consolidado (mínimo para IA funcionar):

```bash
supabase secrets set OPENAI_API_KEY=sk-...
```

Exemplo completo (com billing e PDF):

```bash
supabase secrets set \
  OPENAI_API_KEY=sk-... \
  STRIPE_SECRET_KEY=sk_live_... \
  STRIPE_PRICE_ID=price_... \
  APP_URL=https://seu-site.netlify.app \
  STRIPE_WEBHOOK_SECRET=whsec_... \
  BROWSER_PDF_WS_ENDPOINT=wss://chrome.browserless.io?token=...
```

---

## 5. IA — OpenAI (default) + Gemini (Deep Research)

### OpenAI ✅ (provider default)
1. Crie uma API key em [platform.openai.com](https://platform.openai.com/api-keys).
2. `supabase secrets set OPENAI_API_KEY=sk-...`
3. O default do app já é `openai` / `gpt-4o` (ver [`resolveAiRunConfig` em settingsStore.ts](src/stores/settingsStore.ts#L64-L65)) — nada a mudar. A chave **nunca** vai ao cliente: o app chama o [`ai-proxy`](src/services/ai/providers/openAiCompatible.ts#L13), que injeta a chave server-side e autoriza pelo JWT do usuário.

> Se uma feature de IA retornar HTTP 500 com "Server is missing ...", o secret correspondente não foi setado.

### Gemini — Deep Research ⬜ (opcional)
- É a **única** integração de IA que **não** passa pelo proxy: [`deepResearch.ts`](src/services/ai/deepResearch.ts#L17) chama o Google direto do browser (`https://generativelanguage.googleapis.com/v1beta/interactions`).
- Variável **de frontend** (setada na Netlify, não como secret do Supabase): `VITE_GEMINI_API_KEY`.
- Sem ela, o recurso Deep Research simplesmente **não aparece** (feature-gated em [`resolveDeepResearchConfig`](src/services/ai/deepResearch.ts#L37-L39)).
- ⚠️ **Segurança**: por ser `VITE_`, essa chave fica **exposta no bundle** do cliente. Restrinja a chave no Google Cloud (por API/domínio) ou aceite conscientemente o risco. Runs custam ~US$1–3 e levam 5–20 min (cobrado na sua conta Gemini).

---

## 6. Billing — Stripe ⬜ OPCIONAL

Sem isso, todo mundo permanece no tier **free** (3 jobs / 1 tailored resume). O cliente **nunca** vê chaves da Stripe.

### 6.0. Qual integração escolher na Stripe

Ao criar a conta, a Stripe pergunta *"How do you want to accept payments?"*. Escolha **Prebuilt checkout form** ("redirect to a Stripe-hosted page").

Por quê: a function [`create-checkout-session`](supabase/functions/create-checkout-session/index.ts#L52) usa `stripe.checkout.sessions.create({ mode: 'subscription' })` e o app redireciona para a página hospedada da Stripe. As outras opções não servem: **Payment Links** (links avulsos, não amarram ao `user_id`/webhook) e **Embedded components / Elements** (formulário de cartão dentro do site — muito mais trabalho, o código não usa). Mostrar o preço no site e gerenciar a assinatura (Customer Portal, abaixo) funcionam normalmente com o Prebuilt checkout.

### 6.1. Produto, preço e secrets

1. Crie conta na [Stripe](https://dashboard.stripe.com).
2. Crie um **Produto** com um **Price recorrente** (a assinatura Pro). É aqui que você define **valor, moeda e intervalo** (mensal/anual) — o código não tem preço hardcoded. Deve ser **Recurring** (não "one-time"). Copie o `price_...` → `STRIPE_PRICE_ID`.
3. Pegue a **Secret key** (`sk_...`) → `STRIPE_SECRET_KEY` (usada pelas 4 functions de billing).
4. Defina `APP_URL` = URL pública do site na Netlify (usada para `success_url`/`cancel_url` do checkout → `/settings?checkout=success|cancelled`, e para o `return_url` do Customer Portal → `/settings`).
5. Registre o **webhook** em **Developers → Webhooks → Add endpoint**:
   - URL: `https://<PROJECT_REF>.functions.supabase.co/stripe-webhook`
   - Eventos: `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`.
   - Copie o **Signing secret** (`whsec_...`) → `STRIPE_WEBHOOK_SECRET`.

### 6.2. Preço visível no site (ao vivo)

O [`PlanCard`](src/modules/settings/components/PlanCard.tsx) (em Settings) exibe o preço real buscado da Stripe via a function [`get-plan-pricing`](supabase/functions/get-plan-pricing/index.ts) — nada de valor hardcoded, então mudar o preço na Stripe atualiza o site sozinho. Requer só `STRIPE_SECRET_KEY` + `STRIPE_PRICE_ID` (já setados) e o deploy da function (seção 3).

### 6.3. Gerenciar assinatura no site (Customer Portal)

Usuários Pro veem um botão **"Manage subscription"** no PlanCard, que abre o **Stripe Customer Portal** (cancelar, trocar cartão, ver faturas) via a function [`create-portal-session`](supabase/functions/create-portal-session/index.ts).

- ⚠️ **Habilite o Customer Portal uma vez** no dashboard: **Settings → Billing → Customer portal** → *Activate*. Sem isso, a Stripe retorna erro ao criar a sessão do portal.
- É um redirect para uma página hospedada da Stripe (padrão) e volta para `APP_URL/settings`.

**Modelo de segurança** (por que é assim): o cliente nunca escreve o `tier`. Só o `stripe-webhook`, usando a **service_role key**, faz upsert em `subscriptions` (incluindo o `stripe_customer_id` que o portal usa). As tabelas `subscriptions` e `token_usage_logs` têm RLS **SELECT-only** para o dono. Os limites do free são impostos no INSERT via RLS.

---

## 7. Export PDF — Chrome headless remoto ⬜ OPCIONAL

A function [`export-pdf`](supabase/functions/export-pdf/index.ts#L230) renderiza o currículo em PDF. Como um isolate Deno **não** consegue subir o Chromium, ela usa `puppeteer.connect({ browserWSEndpoint })` a um Chrome **remoto**.

1. Provisione um serviço de Chrome headless — ex.: [browserless.io](https://www.browserless.io/) (ou self-host equivalente).
2. No dashboard da browserless, copie o **token** (API Key) e o **connect URL** da sua região. O formato é `wss://<host>?token=SEU_TOKEN`. Contas novas usam subdomínios por região:
   ```
   wss://production-sfo.browserless.io?token=SEU_TOKEN   # San Francisco
   wss://production-lon.browserless.io?token=SEU_TOKEN   # Londres
   wss://production-ams.browserless.io?token=SEU_TOKEN   # Amsterdã
   ```
   ⚠️ Use **exatamente** o host da sua região (o painel mostra qual). O antigo `wss://chrome.browserless.io?token=...` só vale para contas legadas.
3. Configure o secret (entre aspas — o `?`/`=` da URL quebram o shell):
   ```bash
   supabase secrets set BROWSER_PDF_WS_ENDPOINT="wss://production-sfo.browserless.io?token=SEU_TOKEN"
   ```

Sem esse secret, a exportação retorna `500`. Se o token/host estiverem errados, retorna `502`. **Teste pelo app** (exportar um currículo) e confirme que uma sessão aparece no painel da browserless.

---

## 8. Frontend na Netlify ✅ ESSENCIAL

O repo **não tem** config de host — você precisa criar uma.

1. **Crie `netlify.toml`** na raiz do projeto:

   ```toml
   [build]
     command = "yarn build"
     publish = "dist"

   # SPA fallback: toda rota serve o index.html (React Router é client-side)
   [[redirects]]
     from = "/*"
     to = "/index.html"
     status = 200
   ```

2. No painel da Netlify, conecte o repositório Git. O build command e publish dir já virão do `netlify.toml`.

3. **Configure as variáveis de ambiente** em **Site settings → Environment variables**:

   | Variável | Obrigatória? |
   |---|---|
   | `VITE_SUPABASE_URL` | ✅ Sim |
   | `VITE_SUPABASE_ANON_KEY` | ✅ Sim |
   | `VITE_GEMINI_API_KEY` | ⬜ Deep Research |
   | `VITE_POSTHOG_KEY` | ⬜ Analytics |
   | `VITE_POSTHOG_HOST` | ⬜ Analytics (default `https://us.i.posthog.com`) |
   | `VITE_SENTRY_DSN` | ⬜ Monitoring |

   > ⚠️ **Atenção aos fallbacks silenciosos**: [`client.ts`](src/services/supabase/client.ts#L3-L4) usa `http://localhost:54321` / `dummy_key` se as vars faltarem. O build **passa**, mas a autenticação falha **sem erro claro**. Confira as duas `VITE_SUPABASE_*` antes de publicar.

4. Faça o deploy. Anote a URL final (ex.: `https://seu-site.netlify.app`).

5. **Volte e atualize** (se usar billing): `APP_URL` (secret do Supabase) e a URL do webhook na Stripe agora usam a URL pública real.

---

## 9. Analytics + Monitoring ⬜ OPCIONAIS

Ambos são **no-op** se as variáveis não existirem — o app funciona normalmente sem eles.

- **PostHog** ([`analytics.ts`](src/services/analytics/analytics.ts)): `VITE_POSTHOG_KEY` (+ `VITE_POSTHOG_HOST`, default `https://us.i.posthog.com`). Sem a key, nenhum evento é enviado.
- **Sentry** ([`sentry.ts`](src/services/monitoring/sentry.ts)): `VITE_SENTRY_DSN`. Sem o DSN, nenhuma captura de erro.

---

## 10. Higiene e segurança (checklist)

- ⚠️ O `.env` local contém `VITE_OPENAI_API_KEY` com valor real. O `.env` está gitignored, mas **trate essa chave como vazada e rotacione-a**. Ela é **legada e não usada** pelo código (OpenAI vai server-side no `ai-proxy`) — **remova-a do `.env`**.
- Existem `yarn.lock` **e** `package-lock.json` no repo. **Mantenha só um** (yarn) para não confundir o build/CI.
- Comentários desatualizados que você pode ignorar: `registry.ts` ("direct browser access") e o `SUPABASE_SETUP.md` inteiro.
- O JWT do Supabase é guardado em `localStorage` (risco XSS conhecido) — débito técnico a ter em mente.

---

## 11. Ordem recomendada de execução

1. **Supabase**: criar projeto → rodar `supabase-schema.sql` → habilitar Email auth → confirmar RLS.
2. **CLI**: `supabase login` + `supabase link`.
3. **Edge Functions**: deploy das 6 (lembre do `--no-verify-jwt` no `stripe-webhook`).
4. **Secrets**: `OPENAI_API_KEY` (mínimo) + Stripe/PDF conforme o escopo.
5. **Contas externas**: OpenAI (+ Gemini/Stripe/browserless/PostHog/Sentry se quiser). Se usar Stripe, **ative o Customer Portal** (Settings → Billing).
6. **Netlify**: criar `netlify.toml` → setar env vars → deploy.
7. **Ajuste final**: atualizar `APP_URL` e o webhook da Stripe com a URL pública real.
8. **Verificação E2E** (abaixo).

---

## 12. Verificação end-to-end

Após o deploy, valide na URL de produção:

1. **Auth** — criar conta / login por email funciona. (Supabase Auth OK)
2. **DB + RLS + realtime** — adicionar um job; ele aparece e **persiste após refresh**.
3. **IA** — rodar uma feature de IA (ex.: Recruiter Read / Interview Coach); a resposta volta. (ai-proxy + `OPENAI_API_KEY` OK)
   - Se der 500 "Server is missing ...", falta o secret correspondente.
4. **Billing** (se configurado) — em Settings, o card **mostra o preço** (get-plan-pricing OK); iniciar upgrade Pro redireciona para o Stripe Checkout; ao completar em test mode, o webhook muda o `tier` para `pro` em `subscriptions`. Já como Pro, o botão **"Manage subscription"** abre o Customer Portal (Portal ativado na Stripe OK).
5. **Export PDF** (se configurado) — exportar um currículo baixa o PDF. (`BROWSER_PDF_WS_ENDPOINT` OK)
6. **Deep Research** (se configurado) — o recurso só aparece com `VITE_GEMINI_API_KEY` setada.
7. **Observabilidade** (se configurada) — um evento aparece no PostHog / um erro forçado aparece no Sentry.

---

## Agente de descoberta contínua (Fase 14)

Pipeline assíncrono e **scheduler-agnóstico**. O worker é apenas um endpoint HTTP; qualquer agendador o chama.

1. **Migrations:** aplique `0011_discovery_pipeline.sql` e `0012_scoring_snapshot.sql` (SQL Editor ou `supabase db push`). Elas criam `search_profiles`, `discovery_runs`, adicionam `discovered_jobs.score` e habilitam realtime.
2. **Deploy do worker:** primeiro **`yarn build:functions`** (empacota o worker e as funções de email em `index.ts` únicos — o edge-runtime não resolve os imports `@/` sem extensão nem `@octant/email` em runtime), depois `supabase functions deploy discovery-worker --no-verify-jwt`. A fonte editável é `worker.ts` (ou `handler.ts` nas funções de email); `index.ts` é gerado.
   - **404** = função não deployada nesse projeto; **401** = faltou `--no-verify-jwt`; **503 + "Module not found"** no log = deployou a fonte em vez do bundle (rode `yarn build:functions`).
   - Secrets: `supabase secrets set DISCOVERY_CRON_SECRET=<aleatório> GEMINI_API_KEY=<chave>` (opcional `FREE_TIER_MONTHLY_TOKEN_LIMIT`).
   - O `deno.json` do worker usa import map (`@/` → `src/`) + `sloppy-imports` para reusar o núcleo puro do app. Se o edge-runtime rejeitar sloppy-imports no deploy, o fallback é mover os arquivos puros para `_shared/discovery/` com extensões `.ts`.
3. **Scheduler externo** (não depende de pg_cron). Modo agendado: `POST` com header `x-discovery-secret` e body vazio → o worker seleciona os usuários "due" por cadência de plano (free: 24h, pro: 1h). Exemplo GitHub Actions:
   ```yaml
   # .github/workflows/discovery-tick.yml
   name: discovery-tick
   on:
     schedule: [{ cron: '0 * * * *' }]   # de hora em hora
   jobs:
     tick:
       runs-on: ubuntu-latest
       steps:
         - run: |
             curl -fsS -X POST "$SUPABASE_URL/functions/v1/discovery-worker" \
               -H "x-discovery-secret: $DISCOVERY_CRON_SECRET" -H "content-type: application/json" -d '{}'
         env:
           SUPABASE_URL: ${{ secrets.SUPABASE_URL }}
           DISCOVERY_CRON_SECRET: ${{ secrets.DISCOVERY_CRON_SECRET }}
   ```
   Alternativas equivalentes: pg_cron + pg_net (`net.http_post`), Trigger.dev, Inngest — todos apenas chamam o mesmo endpoint.
4. **Verificação:** dispare o tick (ou "Run now" no app, que usa o JWT); `discovery_runs` deve transitar `running → succeeded` e novas linhas `discovered_jobs` (com `score` + `data.analysis`) aparecem no feed por realtime. Sem `GEMINI_API_KEY` o worker responde 500; o custo é limitado pelo teto mensal de tokens por usuário (free), Pro é ilimitado.
