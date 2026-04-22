---
name: review-pr
description: End-to-end PR workflow for NeighborSwap. Creates a PR, self-reviews it against project conventions, applies fixes, pushes to GitHub, and analyses CI pipeline results.
version: 1
---

# /review-pr

Create a pull request, self-review it, apply fixes, push to GitHub, and monitor the CI pipeline to completion.

## Usage

```
/review-pr [optional: branch name or description]
```

**Example:**
```
/review-pr
/review-pr add-listing-feature
```

If no branch name is provided, infer one from `git status` and recent commits.

---

## Workflow

Follow these steps in order. Do not skip steps.

---

### Step 1 — Pre-flight checks

Run all quality gates before touching git:

```bash
npx tsc --noEmit
npm run test
npm run lint
npm run build
```

For **each failure**:
1. Diagnose the root cause.
2. Fix it — never suppress with `@ts-ignore`, `eslint-disable`, or `as any`.
3. Re-run to confirm the fix.
4. Ask the user to verify:
   > "I fixed a pre-flight issue: `<description>`. Please confirm before I continue."

Only proceed to Step 2 when all four gates pass (or the user explicitly acknowledges a known pre-existing failure that is out of scope).

---

### Step 2 — Stage, commit, and push to GitHub

1. Run `git status` and `git diff` to review all uncommitted changes.
2. Run `git log --oneline -10` to understand the recent commit history and match the project's commit message style.
3. If there are uncommitted changes, stage only relevant files — do **not** use `git add -A` or `git add .` blindly. Exclude:
   - `.env*`, `*.local`, credential files
   - Large binaries unrelated to the feature
4. If there are staged changes, write a concise commit message (imperative mood, ≤72 chars subject line) and commit:

```bash
git commit -m "$(cat <<'EOF'
<subject line>

<optional body>

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
EOF
)"
```

5. Push the branch to GitHub. Check whether an upstream is already configured:

```bash
# Check if upstream is set
git rev-parse --abbrev-ref --symbolic-full-name @{u} 2>/dev/null
```

- If **no upstream** is set (command fails or returns nothing), push and set it:
  ```bash
  git push -u origin <branch-name>
  ```
- If **upstream is already set**, push normally:
  ```bash
  git push
  ```

Confirm the push succeeded before continuing.

---

### Step 3 — Create the pull request on GitHub

First check whether a PR already exists for this branch:

```bash
gh pr view --json url,state 2>/dev/null
```

- If a PR **already exists** and is open, skip creation and report the existing PR URL to the user. Proceed to Step 4.
- If **no open PR exists**, create one:

```bash
gh pr create --title "<concise title under 70 chars>" --base main --body "$(cat <<'EOF'
## Summary
- <bullet 1>
- <bullet 2>
- <bullet 3>

## Changes
| File | Change |
|------|--------|
| `path/to/file` | Description |

## Test plan
- [ ] All unit tests pass (`npm run test`)
- [ ] TypeScript compiles clean (`npx tsc --noEmit`)
- [ ] Lint passes (`npm run lint`)
- [ ] Build succeeds (`npm run build`)
- [ ] Manual smoke test: <step-by-step description>

## Security checklist
- [ ] No secrets committed (Gitleaks)
- [ ] RLS enabled on any new Supabase tables
- [ ] PII stripped from Groq prompts
- [ ] All Server Actions validate input with Zod
- [ ] No `any` types introduced

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

Report the PR URL to the user before continuing.

---

### Step 4 — Self-review the PR

Fetch the full diff of the PR and review it against every item in the NeighborSwap security and architecture checklist.

```bash
git diff main...HEAD
gh pr view --json title,body,files
```

Evaluate against these categories. For each, produce a verdict: ✅ PASS, ⚠️ WARN, or ❌ FAIL.

| Category | Checks |
|----------|--------|
| **Security** | No secrets; RLS on new tables; no service role key in client paths; PII stripped before Groq; Zod validation at every Server Action boundary; no injection vectors |
| **Architecture** | Server Actions for all mutations (no `POST /api` for UI writes); server Supabase client in server code only; browser Supabase client only for auth/real-time; agents call Groq only via `groq-client.ts` |
| **Type safety** | No `any`; no `@ts-ignore`; no type assertions hiding bugs |
| **Conventions** | Functional components only; `lucide-react` for icons; types in `src/types/`; agents are pure inference (no DB access) |
| **Tests** | Co-located test file for every new module with logic; agent tests mock `groq-client.ts`; no live API calls in tests |
| **Code quality** | No premature abstractions; no dead code; comments only where WHY is non-obvious |

Produce a review report:

```
## PR Self-Review

### Security       ✅/⚠️/❌
### Architecture   ✅/⚠️/❌
### Type safety    ✅/⚠️/❌
### Conventions    ✅/⚠️/❌
### Tests          ✅/⚠️/❌
### Code quality   ✅/⚠️/❌

### Issues found
- [FAIL/WARN] <issue description> — <file:line>

### Verdict
APPROVED / NEEDS CHANGES
```

---

### Step 5 — Apply review fixes

For every ❌ FAIL item from Step 4:
1. Fix the issue in the relevant file.
2. Re-run the affected quality gate to confirm the fix.
3. Stage and commit the fix:

```bash
git commit -m "fix: <description of review fix>

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
git push
```

For every ⚠️ WARN item, ask the user whether to fix it before pushing:
> "I found a warning: `<description>`. Should I fix it before finalising the PR?"

Do not proceed to Step 6 until all ❌ FAIL items are resolved.

---

### Step 6 — Monitor CI pipeline

After the final push, poll the GitHub Actions pipeline until it completes:

```bash
gh pr checks --watch
```

Once complete, fetch the full run summary:

```bash
gh run list --branch <branch-name> --limit 1
gh run view <run-id> --log-failed
```

Parse and report results for each CI gate defined in `CLAUDE.md`:

| Gate | Status | Notes |
|------|--------|-------|
| 1. Secrets detection (Gitleaks) | ✅/❌ | |
| 2. Lint + Prettier | ✅/❌ | |
| 3. Type check | ✅/❌ | |
| 4. Unit & integration tests | ✅/❌ | |
| 5. E2E tests (Playwright) | ✅/❌ | |
| 6. Dependency scan (`npm audit`) | ✅/❌ | |
| 7. SAST (CodeQL) | ✅/❌ | |
| 8. Build verification | ✅/❌ | |

---

### Step 7 — Fix CI failures (if any)

For each failed CI gate:
1. Read the full failure log from `gh run view --log-failed`.
2. Identify the root cause — do not guess.
3. Fix the issue locally, re-run the relevant command to confirm, then commit and push.
4. Report what was fixed and why.

Repeat until all eight gates are green. If a gate failure is outside your control (e.g., flaky E2E, missing env var in CI), explain clearly and ask the user how to proceed.

---

### Step 8 — Final report

Produce a concise final summary:

```
## PR Complete

**PR URL:** <url>
**Branch:** <branch>
**Commits:** <count>

### CI Pipeline: ✅ ALL GATES PASSED / ❌ <N> gates failed

### Changes shipped
- <file>: <what changed>

### Review issues found & fixed
- <issue>: <fix applied>

### Outstanding items (if any)
- <item>: <reason deferred>
```

---

## Constraints

- Never force-push (`git push --force`) to `main` or `master`.
- Never skip hooks (`--no-verify`) or bypass signing.
- Never commit `.env*` files, credentials, or API keys.
- Always create a **new commit** for review fixes — never amend a pushed commit.
- Do not merge the PR — leave that to the user.
- If any CI gate is blocked by a missing secret or environment variable in GitHub Actions, document it and ask the user — do not invent workarounds.
- Match commit message style to recent project history (`git log --oneline`).
