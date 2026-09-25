# Documentação do Octant

Índice da documentação técnica. Para a visão geral do produto, comece pelo [README principal](../README.md).

## Estado atual

O Octant está em produção em [useoctant.com](https://useoctant.com/login): SPA em React 19 e TypeScript
na Netlify, com Supabase (Postgres, Auth, RLS, Realtime e Edge Functions em Deno), Stripe para cobrança e
Resend para email. Todo push e pull request passa por lint, cerca de 515 testes (unidade, componentes e
banco de dados no PGlite), build, `deno check` nas Edge Functions escritas à mão e a checagem de que os
bundles das funções estão atualizados.

Limitações conhecidas, e aceitas por enquanto: não há fila offline (uma escrita que falha é avisada e
ressincronizada), a última escrita ganha entre dispositivos e o orçamento de tokens de IA é checado antes
de cada chamada, não reservado de forma atômica. Os motivos estão em
[decisoes-tecnicas.md](decisoes-tecnicas.md).

## Por onde começar

| Documento | Assunto |
|---|---|
| [architecture.md](architecture.md) | Camadas e regras entre elas, fluxo de dados, realtime, design system, integridade do JSONB. É a referência mais atual. |
| [decisoes-tecnicas.md](decisoes-tecnicas.md) | As principais decisões, cada uma com contexto, decisão, trade-off e resultado |
| [PRODUCTION.md](PRODUCTION.md) | Passo a passo para colocar em produção: chaves, migrations, Edge Functions, Stripe, agendador |

## Por área

| Documento | Assunto |
|---|---|
| [database.md](database.md) · [supabase.md](supabase.md) | Tabelas, RLS, realtime e o uso do Supabase |
| [frontend.md](frontend.md) · [stores.md](stores.md) | Estrutura dos componentes e as stores Zustand |
| [services.md](services.md) | A camada de lógica pura em `src/services` |
| [ai.md](ai.md) | Provedores de IA, tarefas e proteções contra alucinação |
| [resume-engine.md](resume-engine.md) | Projeção da base de conhecimento e gerador de currículo |
| [interview-engine.md](interview-engine.md) | Preparação para entrevista |
| [email.md](email.md) | Infraestrutura de email transacional |
| [future-roadmap.md](future-roadmap.md) | Roadmap escrito no início da migração para o Supabase |

Os documentos por área foram escritos durante a migração do app local (IndexedDB) para o Supabase, e
parte das dívidas que eles listam já foi resolvida. Quando algum deles divergir do código, valem o
`architecture.md` e o próprio código.

## Glossário

- **Base de conhecimento:** a estrutura completa da carreira do usuário (perfil, experiências, projetos,
  skills, fatos, histórias, métricas). É a única fonte de verdade.
- **Master Resume:** a projeção da base de conhecimento no formato de currículo, calculada em tempo de
  execução.
- **Currículo adaptado:** a seleção e ordenação dos itens do Master Resume para uma vaga específica.
- **Agente de busca:** o pipeline de descoberta de vagas (estratégias, busca com Google Search, dedupe,
  score determinístico, fila de revisão). Roda com o app aberto e, de forma agendada, na Edge Function
  `discovery-worker`.

## Onde começar a ler o código

- `src/app/routes.tsx`: rotas e carregamento sob demanda.
- `src/contexts/AuthContext.tsx`: sessão, carregamento dos dados e assinaturas do realtime.
- `src/stores/resumeStore.ts`: a base de conhecimento, que alimenta todo o resto.
- `src/services/analysis/`: o cálculo de match e do score ATS.
- `src/services/ai/registry.ts`: como a IA se conecta sem virar fonte de verdade.
