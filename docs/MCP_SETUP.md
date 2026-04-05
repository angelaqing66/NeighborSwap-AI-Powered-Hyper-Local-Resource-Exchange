# MCP Integration: Supabase

This document describes how the Supabase MCP server is configured in this project and demonstrates the workflow it enables.

## What is MCP?

Model Context Protocol (MCP) is an open standard that lets Claude Code connect to external services through a structured tool interface. Instead of copy-pasting SQL into a dashboard, you instruct Claude directly and it executes operations against the live service.

## Server Used

**Supabase MCP** — official MCP server provided by Supabase at `https://mcp.supabase.com`. It exposes tools for schema migrations, SQL execution, branch management, edge functions, and more.

## Setup

### Prerequisites

- A Supabase project (free tier works)
- Claude Code CLI installed
- Supabase project reference ID (found in your project URL: `https://supabase.com/dashboard/project/<project_ref>`)

### Step 1 — Authenticate

Run the following in your terminal. Claude Code will open a browser window to complete OAuth with your Supabase account:

```bash
claude mcp add --transport http supabase https://mcp.supabase.com/mcp?project_ref=<your_project_ref>
```

On success you will see: `Authentication successful. Connected to supabase.`

### Step 2 — Verify the configuration

The command above writes to `.mcp.json` at the project root:

```json
{
  "mcpServers": {
    "supabase": {
      "type": "http",
      "url": "https://mcp.supabase.com/mcp?project_ref=<your_project_ref>"
    }
  }
}
```

Commit this file so teammates get the same server configuration automatically when they open the project in Claude Code.

### Step 3 — Confirm in Claude Code

Start a new Claude Code session. Type `/mcp` — you should see `supabase` listed as a connected server.

---

## Demonstrated Workflow: Database Schema Deployment

The following workflow was executed entirely through Claude Code using the Supabase MCP — no Supabase dashboard interaction was required.

### Goal

Apply three SQL migrations that define the full NeighborSwap schema (`users`, `items`, `trades`) to a blank Supabase project.

### Tools used

| MCP Tool | Purpose |
|---|---|
| `mcp__supabase__list_migrations` | Confirm no migrations had been applied yet |
| `mcp__supabase__apply_migration` | Execute each SQL migration against the live database |

### Migrations applied (in order)

1. **`set_updated_at` helper** — shared trigger function used by all three tables  
2. **`20260321000000_create_users`** — `public.users` table extending `auth.users`, with `trust_score`, RLS policies, and a signup trigger that auto-populates the profile  
3. **`20260321000001_create_items`** — `public.items` table with `item_status` enum, provider FK, and RLS policies  
4. **`20260322000001_create_trades`** — `trades` table with `trade_status` enum (9-state machine), AI moderation columns, logistics JSONB, all indexes, and RLS policies  

### What the MCP enabled

- **No manual SQL copy-paste** — migrations ran directly from the Claude Code session
- **Ordered execution** — Claude applied the helper function before tables that depend on it, and `users` before `items`/`trades` that reference it
- **Live verification** — `list_migrations` confirmed state before and after, making the process auditable
- **Error surfacing** — any SQL error (wrong FK reference, duplicate type, etc.) was returned immediately so it could be corrected in the same session

### Reproducing the workflow

```
1. Open the project in Claude Code
2. Type /mcp  → confirm supabase is connected
3. Ask Claude: "Apply the migrations in supabase/migrations/ in order"
4. Claude calls list_migrations to check current state, then apply_migration for each file
```

---

## Other Available Tools

The Supabase MCP exposes additional tools useful for future workflows:

| Tool | Use case |
|---|---|
| `execute_sql` | Run ad-hoc queries or seed data |
| `list_tables` | Inspect current schema |
| `generate_typescript_types` | Regenerate `src/types/supabase.ts` after schema changes |
| `get_logs` | Tail Supabase function or API logs |
| `create_branch` / `merge_branch` | Database branching for feature development |
| `deploy_edge_function` | Deploy Supabase Edge Functions |
| `get_advisors` | Security and performance recommendations |
