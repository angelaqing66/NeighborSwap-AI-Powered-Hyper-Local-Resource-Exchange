# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@import ./docs/PRD.md

## Project Overview

NeighborSwap is a production-grade hyper-local resource exchange platform (Xianyu-inspired) where neighbors lend, share, barter, and exchange goods and services. AI agents assist in safety moderation, logistics coordination, and social vibe/trust scoring.

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 14+ (App Router) |
| Language | TypeScript (strict mode) |
| Styling | Tailwind CSS |
| Database / Auth | Supabase (PostgreSQL + Row-Level Security + Auth) |
| Real-time | Socket.io |
| AI Inference | Groq Cloud API |

## Commands

```bash
# Install dependencies
npm install

# Development server
npm run dev

# Production build
npm run build

# Run all unit tests
npm run test

# Run a single test file
npx vitest run src/path/to/file.test.ts

# Run tests in watch mode
npx vitest

# Lint
npm run lint

# Type-check without emitting
npx tsc --noEmit
```

## Architecture

### Directory Structure

```
src/
  app/                  # Next.js App Router — pages, layouts, route handlers
    (auth)/             # Auth group (login, register)
    (main)/             # Authenticated app shell
    api/                # API Route Handlers (webhooks, Socket.io upgrade)
  components/           # Shared UI components (Functional Components only)
  lib/
    supabase/           # Supabase client (server + browser variants)
    socket/             # Socket.io server setup and event handlers
    agents/             # AI agent orchestration (see below)
      safety.ts         # Safety agent — content moderation
      logistics.ts      # Logistics agent — pickup/delivery coordination
      vibe.ts           # Vibe agent — trust/social scoring
      runner.ts         # Parallel agent runner (Promise.allSettled)
  actions/              # Next.js Server Actions (all DB mutations go here)
  hooks/                # Client-side React hooks
  types/                # Shared TypeScript types and Zod schemas
docs/
  PRD.md
```

### AI Agent Architecture

The inference layer is fully decoupled from application logic. All three agents (`safety`, `logistics`, `vibe`) share a common interface and are invoked in parallel via `lib/agents/runner.ts` using `Promise.allSettled` — a failure in one agent must never block the others.

Each agent takes a typed `AgentInput` and returns a typed `AgentOutput`. Agents call the **Groq Cloud API** directly (not via a Next.js route) and must be callable from both Server Actions and background jobs.

```ts
// Canonical agent signature
interface AgentInput { /* context-specific fields */ }
interface AgentOutput { verdict: string; confidence: number; reasoning: string }

async function runAgent(input: AgentInput): Promise<AgentOutput>
```

### Data Layer (Supabase)

- All DB access goes through the **server-side Supabase client** (`lib/supabase/server.ts`).
- The browser client (`lib/supabase/client.ts`) is used only for Auth state and real-time subscriptions.
- Row-Level Security (RLS) must be enabled on all tables; never bypass it with the service role key in client-accessible code.
- Database mutations are performed exclusively via **Server Actions** (`actions/`), never directly from client components.

### Real-time (Socket.io)

Socket.io is initialized once in `lib/socket/` and attached to the Next.js custom server. Events follow a namespaced pattern: `listing:<id>:update`, `chat:<roomId>:message`, etc.

## Conventions

- **Components**: Functional components only. No class components.
- **Icons**: `lucide-react` exclusively — no other icon libraries.
- **Mutations**: Server Actions in `actions/` for all writes. No `fetch('/api/...')` calls for mutations.
- **Typing**: `strict: true` in `tsconfig.json`. Avoid `any`; use `unknown` and narrow explicitly.
- **Env vars**: Server-only secrets (Groq API key, Supabase service role) must only be accessed in server-side code. Prefix public vars with `NEXT_PUBLIC_`.

### Agent Conventions

- **Single Groq entry point**: All agents call Groq exclusively through `lib/agents/groq-client.ts`. No agent imports the Groq SDK directly.
- **Agent signature**: Every agent exports one async function — `run<AgentName>(input: <AgentName>Input): Promise<<AgentName>Output>`. Inputs and outputs are named interfaces, not inline types.
- **No DB access in agents**: Agents are pure inference functions. DB writes from agent results happen in `actions/` Server Actions only.
- **JSON output contract**: Every agent instructs the model to return a JSON object. If JSON parsing fails, the agent returns a safe default (`verdict: 'review'`, `confidence: 0`) — it never throws a parse error.
- **PII in prompts**: Strip or redact user-identifying fields before passing content to Groq. Only `trade_id` may be forwarded for audit correlation — never `initiator_id`, `counterparty_id`, or raw user content containing names/contact details.
- **Tests**: Every agent has a co-located `__tests__/<agent>.test.ts`. Mock `groq-client.ts` via `vi.mock`; never make live API calls in tests. Include at least one LLM-as-judge eval test that scores the agent's `reasoning` field for quality.

#### Agent File Layout

```
src/lib/agents/
  groq-client.ts        # Thin Groq API wrapper — the only file that reads GROQ_API_KEY
  runner.ts             # Parallel runner — Promise.allSettled over all three agents
  safety.ts             # Safety agent — PII redaction + content moderation
  logistics.ts          # Logistics agent — pickup/delivery coordination
  vibe.ts               # Vibe agent — trust/social scoring
  __tests__/
    safety.test.ts
    logistics.test.ts
    vibe.test.ts
    runner.test.ts
```

#### Canonical Agent Interfaces

```ts
// groq-client.ts
function callGroq(systemPrompt: string, userPrompt: string): Promise<string>

// safety.ts
interface SafetyAgentInput {
  trade_id: string            // audit correlation only — not sent to Groq
  initiator_id: string        // audit correlation only — not sent to Groq
  listing_title: string
  listing_description: string
  agreed_terms: string | null
}
interface SafetyAgentOutput {
  verdict: 'allow' | 'block' | 'review'
  confidence: number                       // 0.0–1.0
  reasoning: string
  redacted_description: string | null      // PII replaced with [REDACTED], or null if verdict is 'allow'
}
async function runSafety(input: SafetyAgentInput): Promise<SafetyAgentOutput>

// runner.ts
interface AgentRunnerInput {
  trade_id: string
  initiator_id: string
  listing_title: string
  listing_description: string
  agreed_terms: string | null
}
interface AgentRunnerResult {
  safety: SafetyAgentOutput | null    // null if agent rejected
  logistics: LogisticsData | null     // null if agent rejected or not yet run
  vibe: number | null                 // null if agent rejected or not yet run
  errors: Record<string, unknown>     // keyed by agent name on rejection
}
async function runAgents(input: AgentRunnerInput): Promise<AgentRunnerResult>
```

## Project-Specific Do's and Don'ts

### 1. Agent Failures — use `Promise.allSettled`, not `Promise.all`
- **Do**: Run all three agents in parallel via `Promise.allSettled` in `runner.ts` and handle each result as `{ status: 'fulfilled' | 'rejected', value/reason }`. Degrade gracefully — a listing can proceed with partial agent results.
- **Don't**: Use `Promise.all`. A single Groq timeout or rate-limit error will throw and kill the entire moderation pipeline, blocking the user action.

### 2. Supabase Client — never let the server client reach the browser
- **Do**: Import `lib/supabase/server.ts` in all Server Actions, Route Handlers, and server components. Use `lib/supabase/client.ts` only in client components, and only for Auth state and real-time subscriptions.
- **Don't**: Use the service role key in any code path reachable by the client, or call the server client inside a `'use client'` component. RLS is the security boundary — bypassing it with the service role key in client-accessible code is a critical vulnerability.

### 3. Mutations — Server Actions only, no ad-hoc `POST` routes
- **Do**: Put every DB write (create listing, send message, update trade status) in `actions/` as a Server Action. This keeps mutations type-safe end-to-end and integrates with `useTransition` and Next.js cache revalidation.
- **Don't**: Create `POST /api/...` Route Handlers for UI-initiated mutations. This creates a parallel, untyped mutation path that duplicates Server Action logic and loses the type safety between client and server that TypeScript + Server Actions provide.

## Testing

- **Unit tests**: Vitest. Co-locate test files as `*.test.ts` or `*.test.tsx`.
- **AI evaluation**: Use an **LLM-as-judge** strategy for agent outputs — a separate evaluator prompt scores the agent's `reasoning` field for correctness, relevance, and safety. Evaluation tests live in `src/lib/agents/__tests__/`.
- Mock the Groq client in unit tests; never make live API calls in the test suite.

```ts
// Example: mocking Groq in Vitest
vi.mock('@/lib/agents/groq-client', () => ({ callGroq: vi.fn() }))
```

## CI/CD Pipeline

Eight-gate pipeline defined in `.github/workflows/`:

| # | Gate | Workflow | Blocks merge? |
|---|------|----------|---------------|
| 1 | Secrets detection (Gitleaks) | `ci.yml`, `pre-commit.yml` | Yes |
| 2 | Lint + Prettier | `ci.yml` | Yes |
| 3 | Type check (`tsc --noEmit`) | `ci.yml` | Yes |
| 4 | Unit & integration tests (Vitest) | `ci.yml` | Yes |
| 5 | E2E tests (Playwright) | `ci.yml` | Yes |
| 6 | Dependency scan (`npm audit --audit-level=high`) | `ci.yml` | Yes |
| 7 | SAST (CodeQL — security-and-quality queries) | `ci.yml` | Yes |
| 8 | Build verification | `ci.yml` | Yes |

**Additional automation:**
- `ai-pr-review.yml` — Claude AI reviews every PR for security, architecture, and conventions
- `preview-deploy.yml` — Vercel preview deploy on every PR (posts URL as comment)
- `production-deploy.yml` — Vercel production deploy on merge to `main`

**Local pre-commit hooks** (`.husky/pre-commit`): Gitleaks + lint-staged run before every commit.

## Security

### Definition of Done — Security Acceptance Criteria

Every PR and feature must satisfy all of the following before merge:

- [ ] No secrets, credentials, or API keys committed (Gitleaks passes)
- [ ] `npm audit` reports no high or critical vulnerabilities
- [ ] CodeQL SAST scan shows no new security alerts
- [ ] RLS enabled on all new Supabase tables; no service role key in client-reachable code
- [ ] PII stripped from all Groq prompts (only `trade_id` forwarded)
- [ ] New Server Actions validate and sanitize all inputs at the boundary
- [ ] No `any` types that could mask injection or type-confusion bugs
- [ ] Claude AI PR review passes (no ❌ FAIL on security category)

### OWASP Top 10 Awareness

The following OWASP Top 10 (2021) risks are most relevant to NeighborSwap and must be considered during development and review:

| # | Risk | NeighborSwap mitigations |
|---|------|--------------------------|
| A01 | Broken Access Control | Supabase RLS on all tables; Server Actions enforce auth; never expose service role key to client |
| A02 | Cryptographic Failures | Supabase handles auth token encryption; no custom crypto; secrets in env vars only (never in code) |
| A03 | Injection | Parameterized queries via Supabase SDK (no raw SQL from user input); Zod schema validation at action boundaries |
| A04 | Insecure Design | Threat-model new features against this list; safety agent moderates listing content before publish |
| A05 | Security Misconfiguration | RLS required on all tables; NEXT_PUBLIC_ prefix only for truly public values; CodeQL + npm audit in CI |
| A06 | Vulnerable & Outdated Components | `npm audit` gate in CI blocks high/critical CVEs; Dependabot PRs reviewed weekly |
| A07 | Identification & Auth Failures | Supabase Auth for all sessions; no custom session management; Server Actions revalidate auth on every request |
| A08 | Software & Data Integrity Failures | Gitleaks pre-commit + CI; no `--no-verify` pushes; production deploy only from `main` after all gates pass |
| A09 | Security Logging & Monitoring | Supabase logs all auth events; agent `trade_id` audit trail; Vercel request logs retained |
| A10 | Server-Side Request Forgery | Groq calls made server-side only; no user-controlled URLs used in server fetch calls |

**Key rules derived from OWASP:**
- Never trust client input — validate with Zod in every Server Action.
- Never construct DB queries from raw user strings — always use the Supabase SDK's parameterized interface.
- Strip PII before forwarding content to external AI APIs (Groq).
- Enforce authentication checks at the Server Action level, not only in UI guards.
