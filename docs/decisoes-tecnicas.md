# Decisões técnicas

Registro das decisões que mais moldaram o Octant: o problema que eu tinha, o que escolhi, o que abri
mão e como ficou. Cada item aponta para o código ou a migration onde a decisão está implementada.

---

## 1. O código decide o que é verdade; a IA só escreve

**Contexto.** O produto gera currículos, scores e explicações sobre a carreira de uma pessoa. Se um modelo
inventa uma skill ou uma experiência, o currículo passa a mentir, e prompt nenhum garante que isso não
aconteça.

**Decisão.** Tudo o que é fato é calculado por código determinístico: o match é uma interseção entre as
skills da vaga e as do currículo ([match.ts](../src/services/analysis/match.ts)), o gerador só seleciona e
ordena bullets que já existem, cada um com o id do fato de origem
([generate.ts](../src/services/generator/generate.ts)). A IA entra para explicar, sugerir perguntas e
corrigir respostas, e o texto dela passa pelo mesmo extrator de skills da análise
([grounding.ts](../src/services/ai/guardrails/grounding.ts)): skill citada que não está no currículo nem na
vaga é marcada, e nas explicações do agente de busca o texto é descartado
([enrich.ts](../src/services/discovery/enrich.ts)). Quando a IA transcreve (importar currículo, extrair
vagas), ela devolve só JSON, que o código valida e normaliza, com uma nova tentativa se vier quebrado.

**Trade-off.** O gerador não reescreve bullets, então o currículo adaptado nunca fica mais "bonito" do que
o texto que a pessoa cadastrou. A checagem de grounding só enxerga skills da taxonomia; uma afirmação falsa
sem nome de tecnologia passa.

**Resultado.** Os invariantes (matched ⊆ currículo, determinismo, bullets rastreáveis) têm testes de
unidade, e trocar de provedor de IA não muda nenhum score.

---

## 2. Integridade do JSONB em duas camadas

**Contexto.** As entidades são linhas `{ id, user_id, data jsonb }`. O RLS diz quem pode gravar uma linha,
mas não o que ela pode conter: um cliente com bug (ou uma versão antiga do app, ou o worker) podia gravar
um documento que derrubava a página na próxima leitura.

**Decisão.** No banco, uma constraint `CHECK` por coluna JSONB
([0017](../supabase/migrations/0017_jsonb_shape_checks.sql)): o documento precisa ser um objeto, o `id`
interno tem que bater com o da linha, os campos que a interface lê precisam existir e há um teto de
tamanho. As constraints entram como `NOT VALID` e só são validadas quando as linhas antigas passam. Na
leitura, schemas zod ([schemas.ts](../src/repositories/schemas.ts)) reparam o que tem um padrão seguro
(uma lista ausente vira `[]`) e descartam, com registro no Sentry e sem o conteúdo, o que não é confiável.

**Trade-off.** Considerei o `pg_jsonschema`, mas preferi SQL puro: não depende de extensão e roda igual no
PGlite dos testes. Em troca, as checagens são rasas; a validação profunda fica no zod, do lado do cliente.
Existem duas definições de forma para manter em sincronia.

**Resultado.** Dados legados nunca travam um deploy, toda escrita nova é checada e uma linha corrompida
não quebra mais a tela inteira. Os testes em [supabase/tests](../supabase/tests) aplicam a 0017 inclusive
num banco que já tem linhas ruins.

---

## 3. Limites do plano Free garantidos pelo RLS

**Contexto.** O Free permite 3 vagas e 1 currículo adaptado. Um limite só na interface é contornado com
uma chamada direta à API do Supabase.

**Decisão.** Os limites ficam em políticas `WITH CHECK` de INSERT
([0007](../supabase/migrations/0007_subscriptions_and_plan_limits.sql)), com funções `security definer`
(`within_job_limit`, `within_tailored_resume_limit`). A contagem exclui a própria linha, porque o upsert
também passa pelo `WITH CHECK` de INSERT, e sem isso regravar uma vaga existente seria bloqueado. As
constantes em [plan.ts](../src/constants/plan.ts) existem só para a interface mostrar o aviso de upgrade
antes de a escrita falhar; quando ela falha mesmo assim, o `persist()` reconcilia e o item some da tela.

**Trade-off.** O número 3 aparece em dois lugares (SQL e TypeScript). A contagem não trava a tabela, então
duas inserções simultâneas podem passar juntas; aceitei, porque o pior caso é uma vaga a mais no Free.

**Resultado.** Há teste de banco para "limita o Free a 3 vagas, mas deixa regravar uma existente" e para
"o cliente não consegue gravar o próprio plano".

---

## 4. Webhook do Stripe: gravar o plano é o contrato, e só eventos mais novos valem

**Contexto.** O Stripe não garante a ordem de entrega. Um `customer.subscription.updated` atrasado podia
chegar depois de um `.deleted` e devolver o Pro para quem cancelou. Além disso, o mesmo webhook manda
emails de cobrança, e uma falha no email não pode fazer o Stripe reenviar um evento que já foi aplicado.

**Decisão.** A escrita do plano passa pela função `apply_subscription_event`
([0018](../supabase/migrations/0018_subscription_events.sql)), que só aplica o evento se ele for pelo menos
tão novo quanto o último gravado. A comparação fica no `ON CONFLICT ... WHERE`, então duas entregas
simultâneas não se intercalam. No [handler](../supabase/functions/stripe-webhook/handler.ts), erro de banco
responde 500 (para o Stripe reenviar), evento antigo responde 200 sem mandar email, e o email é melhor
esforço: nunca gera 5xx, e a chave de deduplicação amarrada ao objeto do Stripe evita envio duplo numa
reentrega. Só o `service_role` executa a função.

**Trade-off.** Eventos com o mesmo `created` (resolução de segundos) são aplicados na ordem de chegada. O
email pode se perder se o Resend estiver fora do ar; o plano, não.

**Resultado.** O teste "aplica eventos novos e ignora os antigos" roda no PGlite, e a mudança de plano chega
ao app em tempo real, porque `subscriptions` está na publicação do Realtime.

---

## 5. Chaves de IA só no servidor, com orçamento por plano

**Contexto.** A primeira versão chamava os provedores de IA direto do navegador. Num SaaS isso exige
distribuir a chave (vazamento garantido) ou pedir que cada pessoa traga a sua, e não permite controlar custo.

**Decisão.** Todas as chamadas passam pela Edge Function
[ai-proxy](../supabase/functions/ai-proxy/index.ts): ela valida o JWT, usa endpoints fixos por provedor
(o cliente nunca informa URL, então não há SSRF), limita os tokens de saída por requisição e checa o
consumo do mês em `token_usage_logs` antes de chamar o provedor (Free 100k, Pro 2M, configuráveis).

**Trade-off.** O orçamento é checado antes da chamada, não reservado de forma atômica: requisições
simultâneas podem passar um pouco do teto. O limite de tokens de saída por requisição limita esse excesso.
Toda chamada de IA ganha um salto de rede a mais.

**Resultado.** Nenhuma chave de provedor chega ao bundle, e trocar ou adicionar um provedor é uma entrada
na lista `VENDORS`.

---

## 6. Interface otimista, sem fila offline

**Contexto.** O app nasceu local-first (IndexedDB) e a resposta imediata da interface era parte do produto.
Na migração para o Supabase eu não quis voltar a um spinner por clique.

**Decisão.** As stores Zustand são uma réplica em memória dos dados do usuário. A mutação é aplicada na
hora e o [persist()](../src/stores/persist.ts) grava em segundo plano pelo repositório; se falhar, mostra
um aviso e recarrega do servidor. O Realtime mescla as mudanças por id, o que também absorve o eco da
própria escrita. Regras de lint no [.oxlintrc.json](../.oxlintrc.json) impedem a interface de falar direto
com o Supabase ou com um repositório.

**Trade-off.** Não há fila offline nem retry: uma escrita que falha é descartada e ressincronizada. Entre
dispositivos, a última escrita ganha; o Realtime só diminui a janela.

**Resultado.** A interface responde sem esperar a rede, e a camada de dados é testável sem React.

---

## 7. Um código, dois runtimes

**Contexto.** O agente de busca precisa rodar com o app aberto e também de forma agendada, com o usuário
offline. Duplicar a lógica de scoring e dedupe no servidor faria as duas versões divergirem.

**Decisão.** A lógica de domínio em `src/services` é pura (sem React, sem stores) e roda também no
`discovery-worker`, em Deno. Como o edge-runtime não resolve os imports `@/` sem extensão nem o pacote
interno `@octant/email`, um passo com esbuild ([bundle-functions.mjs](../scripts/bundle-functions.mjs))
gera um `index.ts` único para cada função empacotada, deixando externos só os pacotes `npm:`/`jsr:`.

**Trade-off.** Os `index.ts` gerados ficam versionados e precisam ser regenerados a cada mudança na lógica
compartilhada.

**Resultado.** O CI roda `yarn build:functions` e falha se algum bundle estiver desatualizado; o score que
o worker calcula é o mesmo que o navegador mostraria.
