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
