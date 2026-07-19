# CareerOS AI Architecture

This document outlines how CareerOS interacts with Large Language Models (LLMs). The architecture is designed to be highly pluggable, vendor-agnostic, and fiercely protective of deterministic truth.

---

## 1. Provider Abstraction

CareerOS does not hardcode itself to OpenAI or Anthropic. All LLM interactions flow through a unified `LLMProvider` interface (`src/services/ai/types.ts`).

Every provider must implement a `complete` function that takes a standard `CompletionRequest` (messages, model, temperature) and returns a `CompletionResult` containing the raw text response.

```typescript
export interface LLMProvider {
  id: AiProviderId
  complete(request: CompletionRequest): Promise<CompletionResult>
}
```

This abstraction allows features to request AI generation without knowing whether the backend is ChatGPT, Claude, Gemini, or a local Ollama server.

## 2. Provider Implementations

The `src/services/ai/providers/` directory contains the adapters:
* **OpenAI, OpenRouter, and Local Models**: Share a common adapter (`openAiCompatible.ts`) because they all adhere to the standard `/chat/completions` API shape.
* **Anthropic (Claude)**: Implements custom message mapping to fit Anthropic's Messages API (extracting system prompts).
* **Google (Gemini)**: Uses its own adapter to map into the `generativelanguage` REST shape.

## 3. Prompt Architecture

Prompts are isolated into distinct **Tasks** (`src/services/ai/tasks/`).
Tasks encapsulate the specific business logic for a feature. A task defines the System Prompt and constructs the User Prompt by deeply injecting domain context.

Prompts strictly enforce "Hard rules" that force the model to behave deterministically:
> *"Never invent experience, employers, projects, metrics, seniority, production incidents, or technologies outside the Master Resume evidence."*

## 4. Structured Outputs

Tasks enforce JSON-only responses (e.g., `explainMatch`, `interviewCoach`). 
Instead of relying purely on the model formatting perfectly, the parsing logic (`parseInterviewCoachJson`) defensively scans the raw string to find the first `{` and last `}` to slice out the JSON payload before passing it to `JSON.parse`. 

## 5. Domain Implementations

### Resume Generation
**CRITICAL NOTE**: Resume generation is **NOT** driven by AI. CareerOS intentionally keeps resume generation 100% deterministic (`src/services/generator/`). The generator selects, ranks, and reorders existing bullets based on ATS keyword frequency. It never hallucinates text. The LLM is structurally prevented from writing resume bullets.

### Interview Generation & Coaching
(`src/services/ai/tasks/interviewCoach.ts`)
The AI acts as a strict senior-engineer interviewer. It takes the candidate's answer, compares it against the selected Master Resume evidence, and returns structured feedback (Score, Verdict, Strengths, Gaps, Hard Follow-ups).

### Job Analysis (Recruiter Read)
(`src/services/ai/tasks/explainMatch.ts`)
Takes the deterministic output of the local ATS heuristic (Missing Skills, Matching Skills) and translates it into human-readable feedback, explaining why a recruiter would accept or reject the candidate.

---

## 6. Error Handling & Retries

* **Network Errors**: Handled at the adapter level (`postJson` in `openAiCompatible.ts`). It catches raw `fetch` errors and maps them to user-friendly `AiError` messages, gracefully handling local-server connection failures differently than remote HTTP failures.
* **JSON Parsing Retries**: If a model returns invalid JSON (or includes markdown backticks), the task logic implements a **single-retry fallback loop**. It catches the JSON parsing failure, appends the model's bad output to the message history, and issues an automated follow-up: *"That was not valid JSON. Reply with ONLY the JSON object in the requested schema."*

## 7. Current Risks

1. **Client-Side Keys**: Currently, API keys are stored in a local `vault.ts` and API requests are fired directly from the browser. In an enterprise system, you cannot distribute application keys to the client, nor should you blindly trust user-supplied keys without encryption and tracking.
2. **CORS Vulnerabilities**: Browser-based HTTP requests to third-party AI APIs frequently run into CORS restrictions (e.g., Anthropic's direct API blocks browser requests). 
3. **Fragile JSON Parsing**: Relying on string-slicing and conversational retries for JSON extraction consumes unnecessary tokens and adds latency.

---

## 8. Future Improvements & Enterprise Architecture Proposal

To elevate CareerOS AI to an enterprise-ready posture, we propose migrating the AI execution layer to **Edge Functions** (e.g., Supabase Edge Functions or Vercel Edge).

### Proposed Enterprise Architecture

```mermaid
graph TD
    Client[React Client (Zustand)]
    Edge[Supabase Edge Function]
    DB[(Supabase PostgreSQL)]
    LLM[(External LLM Vendors)]

    Client -->|1. Request AI Task + Auth Token| Edge
    Edge -->|2. Validate Session & Rate Limits| DB
    Edge -->|3. Fetch Secure Vendor API Keys| DB
    Edge -->|4. Dispatch Chat Completion| LLM
    LLM -->|5. Return Payload| Edge
    Edge -->|6. Enforce Structured Outputs (Zod)| Edge
    Edge -->|7. Return Verified JSON| Client
```

### Key Upgrades:
1. **Edge Function Proxy**: Remove `fetch` calls to OpenAI/Anthropic from the React frontend. The frontend will dispatch a request to a `/functions/v1/ai-task` endpoint.
2. **Secure Key Management**: Vendor API keys will be stored securely as environment variables within the Edge environment, completely hidden from the client.
3. **Native Structured Outputs**: Upgrade the provider SDKs to utilize native JSON Schema enforcement (e.g., OpenAI's `response_format: { type: "json_schema" }`) rather than relying on prompt-engineering and manual retries.
4. **Rate Limiting & Telemetry**: Edge functions will enforce user-specific rate limits and log token usage per request for billing and telemetry, which is impossible in a purely client-side architecture.
