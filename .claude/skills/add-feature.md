---
name: add-feature
description: End-to-end workflow for adding a new feature to NeighborSwap. Covers planning, implementation, testing, and documentation in one structured pass.
version: 2
---

## Changelog

### v2 (2026-04-04) — Added pre-existing gap detection (Step 0)
**What changed:** Added a new Step 0 "Health-check the codebase" that runs `tsc`, `npm test`, and `npm run lint` *before* any feature work begins. For each pre-existing failure, Claude must diagnose the root cause, fix it, re-run to confirm, and **ask the user to verify** before continuing.

**Why:** During the first real task (`/add-feature add sign-up function for users`), `npm run lint` silently failed because Next.js 16 dropped `next lint` as a built-in command — but this was only discovered at Step 6, after all feature code was written. The fix (install ESLint, create `eslint.config.mjs`, update the npm script) was deferred as a "pre-existing gap TODO" rather than resolved immediately. The v2 instruction ensures such gaps are caught and fixed upfront on every future run, and the user is asked to confirm each fix before feature work proceeds.

### v1 (2026-04-04) — Initial skill
Steps 1–7 covering: understand → locate files → plan → implement → tests → type-check/lint → summarize.

# /add-feature

Add a new feature to NeighborSwap following the project's architecture and conventions.

## Usage

```
/add-feature <feature description>
```

**Example:**
```
/add-feature user profile page showing trust score and active listings
```

---

## Workflow

Follow these steps in order. Do not skip steps.

### Step 0 — Health-check the codebase (pre-existing gaps)

Before touching any feature code, run the project's quality gates to surface pre-existing failures:

```bash
npx tsc --noEmit
npm run test
npm run lint
```

For **each failure** that is unrelated to the new feature:

1. Diagnose the root cause (read the error, locate the broken file).
2. Fix it — do not skip or suppress errors with `@ts-ignore`, `eslint-disable`, or `as any`.
3. Re-run the failing command to confirm the fix.
4. **Ask the user to verify the fix** before moving on:
   > "I found and fixed a pre-existing issue: `<one-sentence description>`. Please confirm this looks correct before I continue."

Only proceed to Step 1 after the user confirms, or if there are no pre-existing failures.

> **Exception:** If a pre-existing failure is large in scope (e.g., a missing external service, a broken migration requiring DB access), document it clearly in the final summary under "Pre-existing issues found", explain why it was out-of-scope to fix inline, and continue with the feature.

### Step 1 — Understand the feature

- Re-read `CLAUDE.md` and the relevant section of `docs/PRD.md` to confirm the feature aligns with the product vision.
- Identify which layers are involved: UI page, Server Action, DB query, AI agent, real-time event, or some combination.
- State what you will build in one sentence before writing any code.

### Step 2 — Locate affected files

- Run `Glob` and `Grep` to find existing files in the relevant directories (`src/app/`, `src/components/`, `src/lib/`, `actions/`, `src/types/`).
- Read every file you plan to modify before touching it.
- Do not create a new file if an existing one is the right place.

### Step 3 — Plan (no code yet)

List:
1. New files to create (with full path)
2. Existing files to modify (with the specific change)
3. DB migrations needed (if any)
4. New environment variables needed (if any)

Stop here and confirm the plan is sound before proceeding to Step 4.

### Step 4 — Implement

Follow all conventions in `CLAUDE.md`:

- **Components**: Functional components only. `lucide-react` for icons.
- **Data fetching**: Server components fetch data; client components use hooks only for auth state and real-time.
- **Mutations**: Every write goes in `actions/<domain>.ts` as a Server Action. No `POST /api/...` for UI mutations.
- **Supabase client**: Import `lib/supabase/server.ts` in Server Actions and server components. Import `lib/supabase/client.ts` only in `'use client'` components, only for auth state and subscriptions.
- **Types**: Define all new types in `src/types/`. Use `strict: true`; no `any`.
- **AI agents**: If the feature involves AI inference, the agent lives in `src/lib/agents/` and is called only from a Server Action. Agents must not access the DB directly.
- **RLS**: If a new table is added, enable RLS and write policies before writing application code.

### Step 5 — Write tests

- Create a co-located test file (`*.test.ts` or `*.test.tsx`) for every new module with meaningful logic.
- If an AI agent is involved, include at least one LLM-as-judge eval test in `src/lib/agents/__tests__/`.
- Mock `groq-client.ts` via `vi.mock`; never make live API calls.
- Run `npm run test` and confirm all tests pass before proceeding.

### Step 6 — Type-check and lint

```bash
npx tsc --noEmit
npm run lint
```

Fix all errors introduced by the feature. Do not suppress type errors with `@ts-ignore` or `as any`.
If Step 0 already fixed pre-existing lint/type errors, confirm they are still resolved here.

### Step 7 — Summarize

Report back:
- What was built (files created / modified)
- How to exercise the feature manually
- Any follow-up work deferred

---

## Constraints

- Never bypass RLS with the service role key in client-accessible code paths.
- Never call `fetch('/api/...')` from a client component for mutations.
- Never import the Groq SDK directly in an agent file — use `lib/agents/groq-client.ts`.
- Do not add features, refactoring, or "nice-to-haves" beyond the stated request.
- Do not leave the codebase in a broken state (failing build, failing tests, type errors).
- If a DB migration is needed, write it to `supabase/migrations/` with the naming convention `YYYYMMDDNNNNNN_<description>.sql` and note that it must be applied via the Supabase MCP (`mcp__supabase__apply_migration`) or the Supabase dashboard.

---

## Expected Output

At the end of the skill run you must produce:

1. A file diff summary (which files changed and why)
2. Manual test instructions (step-by-step, starting from the browser)
3. Test results output (passing test count)
4. Any outstanding TODOs with their rationale
