# NeighborSwap

A production-grade hyper-local resource exchange platform where neighbors lend, share, barter, and exchange goods and services. AI agents assist in safety moderation, logistics coordination, and community trust scoring.

[![CI](https://github.com/zhaoqing/NeighborSwap-AI-Powered-Hyper-Local-Resource-Exchange/actions/workflows/ci.yml/badge.svg)](https://github.com/zhaoqing/NeighborSwap-AI-Powered-Hyper-Local-Resource-Exchange/actions/workflows/ci.yml)

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16 (App Router) |
| Language | TypeScript (strict mode) |
| Styling | Tailwind CSS |
| Database / Auth | Supabase (PostgreSQL + Row-Level Security + Auth) |
| Real-time | Socket.io |
| AI Inference | Groq Cloud API (llama3-8b-8192) |
| Testing | Vitest + Playwright |

---

## Architecture

```
src/
  app/
    (auth)/               # Login, register
    (main)/               # Authenticated shell
      listings/           # Browse and post items
      trades/             # Trade dashboard
      profile/            # User profile + trust score
    api/
      socket/             # Socket.io health check endpoint
  components/
    auth/                 # LoginForm, SignUpForm
    listings/             # PostItemForm
  lib/
    supabase/             # server.ts (Server Actions) · client.ts (browser/realtime)
    socket/               # Socket.io server setup and event contract
    agents/
      groq-client.ts      # Single Groq API entry point
      runner.ts           # Parallel runner (Promise.allSettled)
      safety.ts           # Safety agent — PII redaction + content moderation
      logistics.ts        # Logistics agent — pickup/delivery scheduling
      vibe.ts             # Vibe agent — community trust scoring
      __tests__/          # Vitest suites + LLM-as-judge evals
  actions/                # Server Actions — all DB mutations
  hooks/
    useListings.ts        # Real-time listings via Supabase Realtime
    useSocket.ts          # Socket.io client hook
  types/                  # Shared TypeScript interfaces
docs/
  PRD.md
  IMPLEMENTATION_PLAN.md
```

### AI Agent Pipeline

When a trade reaches `accepted` status, three agents run in parallel via `Promise.allSettled`. A failure in one agent never blocks the others.

```
Trade accepted
      │
      ▼
 runAgents(input)
  ┌───┴───────────────────────────┐
  │  Promise.allSettled([         │
  │    runSafety(input),          │  → verdict: allow | block | review
  │    runLogistics(agentInput),  │  → method + scheduled_at + location
  │    runVibe(agentInput),       │  → score: 0–100
  │  ])                           │
  └───┬───────────────────────────┘
      │
      ▼
 AgentRunnerResult
  { safety, logistics, vibe, errors }
      │
      ▼
 actions/trades.ts  →  Supabase (DB write)
```

All agents call Groq exclusively through `lib/agents/groq-client.ts`. PII (phone numbers, emails) is stripped before any content reaches Groq.

---

## Prerequisites

- Node.js 20+
- A [Supabase](https://supabase.com) project (free tier works)
- A [Groq Cloud](https://console.groq.com) API key (free tier works)

---

## Local Setup

**1. Clone and install**

```bash
git clone <repo-url>
cd NeighborSwap-AI-Powered-Hyper-Local-Resource-Exchange
npm install
```

**2. Set environment variables**

Copy the example and fill in your values:

```bash
cp .env.local.example .env.local
```

```env
# Supabase — get these from your project settings → API
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=<YOUR_SUPABASE_SERVICE_ROLE_KEY>   # server-only, never expose

# Groq Cloud — https://console.groq.com
GROQ_API_KEY=your-groq-key                        # server-only, never expose

# App URL (used by Socket.io CORS)
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

**3. Apply Supabase migrations**

```bash
npx supabase db push
```

**4. Start the dev server**

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

---

## Available Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start the Next.js development server |
| `npm run build` | Production build |
| `npm run test` | Run all unit tests (Vitest) |
| `npx vitest run src/path/to/file.test.ts` | Run a single test file |
| `npx vitest` | Tests in watch mode |
| `npm run lint` | ESLint |
| `npm run lint:fix` | ESLint with auto-fix |
| `npm run format` | Prettier |
| `npx tsc --noEmit` | Type-check without emitting |
| `npm run test:e2e` | Playwright end-to-end tests |

---

## CI/CD Pipeline

Eight-gate pipeline runs on every pull request. All gates must pass before merge.

| Gate | Workflow | Blocks merge? |
|---|---|---|
| Secrets detection (Gitleaks) | `ci.yml`, `pre-commit.yml` | Yes |
| Lint + Prettier | `ci.yml` | Yes |
| Type check (`tsc --noEmit`) | `ci.yml` | Yes |
| Unit tests (Vitest) | `ci.yml` | Yes |
| E2E tests (Playwright) | `ci.yml` | Yes |
| Dependency scan (`npm audit`) | `ci.yml` | Yes |
| SAST (CodeQL) | `ci.yml` | Yes |
| Build verification | `ci.yml` | Yes |

Additional automation:
- `ai-pr-review.yml` — Claude AI reviews every PR for security, architecture, and conventions
- `preview-deploy.yml` — Vercel preview deploy on every PR
- `production-deploy.yml` — Vercel production deploy on merge to `main`

---

## Key Conventions

- **Mutations**: Server Actions in `actions/` only. No `fetch('/api/...')` for UI mutations.
- **DB access**: Server-side Supabase client in Server Actions and server components. Browser client only for Auth and real-time.
- **AI agents**: All Groq calls go through `lib/agents/groq-client.ts`. Agents never import the Groq SDK directly.
- **PII**: Stripped before content reaches Groq. Only `trade_id` forwarded for audit correlation.
- **Tests**: Mock `groq-client.ts` via `vi.mock`. Never make live API calls in tests.

---

## Security

Every PR must satisfy before merge:

- No secrets committed (Gitleaks passes)
- `npm audit` reports no high/critical CVEs
- RLS enabled on all Supabase tables
- PII stripped from all Groq prompts
- Server Actions validate all inputs (Zod)
- No `any` types masking injection risks

See [CLAUDE.md](./CLAUDE.md) for the full security acceptance criteria and OWASP Top 10 mitigations.

---

## License

MIT
