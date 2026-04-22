// src/app/(main)/dev/eval/page.tsx
// Eval dashboard — test coverage metrics, TDD evidence, and E2E inventory.
// Admin-only server component. Reads coverage/coverage-summary.json at runtime.

import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import fs from 'fs'
import path from 'path'
import Link from 'next/link'
import {
  CheckCircle,
  XCircle,
  FlaskConical,
  GitBranch,
  Terminal,
  FileCode,
  Globe,
  ArrowLeft,
} from 'lucide-react'

export const metadata: Metadata = {
  title: 'Test Coverage — NeighborSwap',
}

// ── Types ─────────────────────────────────────────────────────────────────────

interface CoverageMetric {
  total: number
  covered: number
  skipped: number
  pct: number
}

interface FileCoverage {
  lines: CoverageMetric
  statements: CoverageMetric
  functions: CoverageMetric
  branches: CoverageMetric
}

interface CoverageSummary {
  total: FileCoverage
  [filePath: string]: FileCoverage
}

// ── Static test inventory (counts from vitest run output) ─────────────────────

const UNIT_SUITES = [
  { file: 'src/actions/__tests__/trades.test.ts', tests: 71, module: 'Server Actions' },
  { file: 'src/actions/__tests__/messages.test.ts', tests: 22, module: 'Server Actions' },
  { file: 'src/actions/__tests__/reviews.test.ts', tests: 22, module: 'Server Actions' },
  { file: 'src/actions/__tests__/listings.test.ts', tests: 16, module: 'Server Actions' },
  { file: 'src/actions/__tests__/auth.test.ts', tests: 13, module: 'Server Actions' },
  { file: 'src/lib/agents/__tests__/safety.test.ts', tests: 37, module: 'AI Agents' },
  { file: 'src/lib/agents/__tests__/sentiment.test.ts', tests: 27, module: 'AI Agents' },
  { file: 'src/lib/agents/__tests__/groq-client.test.ts', tests: 21, module: 'AI Agents' },
  { file: 'src/lib/agents/__tests__/vibe.test.ts', tests: 21, module: 'AI Agents' },
  { file: 'src/lib/agents/__tests__/runner.test.ts', tests: 20, module: 'AI Agents' },
  { file: 'src/lib/agents/__tests__/logistics.test.ts', tests: 19, module: 'AI Agents' },
  {
    file: 'src/components/chat/__tests__/TradeStatusPanel.test.ts',
    tests: 39,
    module: 'Components',
  },
  { file: 'src/lib/__tests__/getDevStats.test.ts', tests: 14, module: 'Lib Utilities' },
  { file: 'src/lib/__tests__/getListings.test.ts', tests: 6, module: 'Lib Utilities' },
] as const

const E2E_SUITES = [
  {
    file: 'e2e/smoke.spec.ts',
    tests: 3,
    description: 'Home page load, login/register reachability',
  },
  {
    file: 'e2e/marketplace.spec.ts',
    tests: 4,
    description: 'Listing feed, search input, item card navigation',
  },
  {
    file: 'e2e/item-detail.spec.ts',
    tests: 4,
    description: 'Item detail page, 404 handling, back navigation',
  },
] as const

const TDD_FEATURES = [
  {
    feature: 'Marketplace search & filter',
    red: 'test(marketplace): failing tests for search and filter (TDD red phase)',
    green: 'feat(marketplace): search bar and filter functionality (TDD green phase)',
  },
  {
    feature: 'Item detail + trade creation',
    red: 'test(item-detail): failing tests for trade creation and item detail (TDD red phase)',
    green: 'feat(item-detail): item detail page with request swap flow (TDD green phase)',
  },
  {
    feature: 'AI Agent runner (parallel Promise.allSettled)',
    red: 'Written BEFORE implementation — TDD red phase (runner.test.ts)',
    green: 'feat(agents): sub-agent evidence — runner tests, LLM-as-judge evals',
  },
  {
    feature: 'Safety agent (PII redaction)',
    red: 'Written BEFORE implementation — TDD red phase (safety.test.ts)',
    green: 'feat(safety): message-level PII redaction and phishing link detection',
  },
  {
    feature: 'Logistics agent (pickup scheduling)',
    red: 'Written BEFORE implementation — TDD red phase (logistics.test.ts)',
    green: 'feat(agents): logistics agent implementation (green phase)',
  },
  {
    feature: 'Listings query helper',
    red: 'Written BEFORE implementation — TDD red phase (getListings.test.ts)',
    green: 'feat(marketplace): search bar and filter functionality (TDD green phase)',
  },
] as const

// ── Helper: read coverage-summary.json ───────────────────────────────────────

function loadCoverage(): CoverageSummary | null {
  try {
    const raw = fs.readFileSync(
      path.join(process.cwd(), 'coverage', 'coverage-summary.json'),
      'utf-8'
    )
    return JSON.parse(raw) as CoverageSummary
  } catch {
    return null
  }
}

// ── Sub-components ────────────────────────────────────────────────────────────

function pct(n: number) {
  return `${n.toFixed(1)}%`
}

function PctCell({ value, threshold = 70 }: { value: number; threshold?: number }) {
  const color =
    value >= 90
      ? 'text-emerald-700 font-semibold'
      : value >= threshold
        ? 'text-yellow-700 font-semibold'
        : 'text-red-600 font-semibold'
  return <span className={color}>{pct(value)}</span>
}

function PassBadge({ pass }: { pass: boolean }) {
  return pass ? (
    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700 border border-emerald-200">
      <CheckCircle className="h-3 w-3" />
      PASS
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2 py-0.5 text-xs font-medium text-red-700 border border-red-200">
      <XCircle className="h-3 w-3" />
      FAIL
    </span>
  )
}

interface SummaryCardProps {
  label: string
  pctValue: number
  covered: number
  total: number
  threshold: number
}

function SummaryCard({ label, pctValue, covered, total, threshold }: SummaryCardProps) {
  const pass = pctValue >= threshold
  const color = pass ? 'border-emerald-200 bg-emerald-50' : 'border-red-200 bg-red-50'
  const textColor = pass ? 'text-emerald-700' : 'text-red-600'
  return (
    <div className={`rounded-xl border p-5 ${color}`}>
      <p className={`text-3xl font-bold ${textColor}`}>{pct(pctValue)}</p>
      <p className="mt-1 text-sm font-medium text-gray-700">{label}</p>
      <p className="mt-0.5 text-xs text-gray-500">
        {covered}/{total} covered
      </p>
      <div className="mt-2">
        <PassBadge pass={pass} />
      </div>
    </div>
  )
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default async function EvalPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('users')
    .select('is_admin')
    .eq('id', user.id)
    .single()

  if (!profile?.is_admin) redirect('/')

  const coverage = loadCoverage()
  const tot = coverage?.total

  const totalUnitTests = UNIT_SUITES.reduce((s, x) => s + x.tests, 0)
  const totalE2eTests = E2E_SUITES.reduce((s, x) => s + x.tests, 0)

  const moduleGroups = ['Server Actions', 'AI Agents', 'Lib Utilities', 'Components'] as const
  const threshold = 70

  return (
    <div>
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Link
              href="/dev"
              className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Dashboard
            </Link>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Test Coverage Report</h1>
          <p className="mt-1 text-sm text-gray-500">
            {totalUnitTests} unit tests · {totalE2eTests} E2E tests · threshold 70%
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs text-gray-400 bg-gray-100 rounded-lg px-3 py-2 font-mono">
          <Terminal className="h-3.5 w-3.5" />
          npm run test:coverage
        </div>
      </div>

      {/* Coverage summary cards */}
      {tot ? (
        <>
          <div className="grid gap-4 sm:grid-cols-4 mb-8">
            <SummaryCard
              label="Statements"
              pctValue={tot.statements.pct}
              covered={tot.statements.covered}
              total={tot.statements.total}
              threshold={threshold}
            />
            <SummaryCard
              label="Branches"
              pctValue={tot.branches.pct}
              covered={tot.branches.covered}
              total={tot.branches.total}
              threshold={threshold}
            />
            <SummaryCard
              label="Functions"
              pctValue={tot.functions.pct}
              covered={tot.functions.covered}
              total={tot.functions.total}
              threshold={threshold}
            />
            <SummaryCard
              label="Lines"
              pctValue={tot.lines.pct}
              covered={tot.lines.covered}
              total={tot.lines.total}
              threshold={threshold}
            />
          </div>

          {/* Per-file breakdown table */}
          <div className="mb-8 rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100">
              <h2 className="text-sm font-semibold text-gray-700">Coverage by File</h2>
              <p className="text-xs text-gray-400 mt-0.5">
                Business logic only — UI pages covered by E2E tests
              </p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 text-left">
                    <th className="px-5 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                      File
                    </th>
                    <th className="px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide text-right">
                      Stmts
                    </th>
                    <th className="px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide text-right">
                      Branches
                    </th>
                    <th className="px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide text-right">
                      Funcs
                    </th>
                    <th className="px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide text-center">
                      ≥70%
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {Object.entries(coverage)
                    .filter(([key]) => key !== 'total')
                    .sort(([a], [b]) => a.localeCompare(b))
                    .map(([absPath, metrics]) => {
                      const file = absPath.replace(process.cwd() + '/', '')
                      const pass =
                        metrics.statements.pct >= threshold &&
                        metrics.branches.pct >= threshold &&
                        metrics.functions.pct >= threshold
                      return (
                        <tr key={file} className="hover:bg-gray-50">
                          <td className="px-5 py-2.5 font-mono text-xs text-gray-700">{file}</td>
                          <td className="px-4 py-2.5 text-right text-xs">
                            <PctCell value={metrics.statements.pct} />
                          </td>
                          <td className="px-4 py-2.5 text-right text-xs">
                            <PctCell value={metrics.branches.pct} />
                          </td>
                          <td className="px-4 py-2.5 text-right text-xs">
                            <PctCell value={metrics.functions.pct} />
                          </td>
                          <td className="px-4 py-2.5 text-center">
                            <PassBadge pass={pass} />
                          </td>
                        </tr>
                      )
                    })}
                </tbody>
                <tfoot>
                  <tr className="bg-gray-50 font-semibold border-t-2 border-gray-200">
                    <td className="px-5 py-2.5 text-xs text-gray-700">Total (business logic)</td>
                    <td className="px-4 py-2.5 text-right text-xs">
                      <PctCell value={tot.statements.pct} />
                    </td>
                    <td className="px-4 py-2.5 text-right text-xs">
                      <PctCell value={tot.branches.pct} />
                    </td>
                    <td className="px-4 py-2.5 text-right text-xs">
                      <PctCell value={tot.functions.pct} />
                    </td>
                    <td className="px-4 py-2.5 text-center">
                      <PassBadge
                        pass={
                          tot.statements.pct >= threshold &&
                          tot.branches.pct >= threshold &&
                          tot.functions.pct >= threshold
                        }
                      />
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </>
      ) : (
        <div className="mb-8 rounded-xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-800">
          Coverage data not found. Run{' '}
          <code className="font-mono bg-amber-100 px-1 rounded">npm run test:coverage</code> to
          generate it.
        </div>
      )}

      {/* Unit test inventory */}
      <div className="mb-8 rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-2">
          <FlaskConical className="h-4 w-4 text-indigo-500" />
          <div>
            <h2 className="text-sm font-semibold text-gray-700">
              Unit Tests (Vitest) — {totalUnitTests} tests · 14 files
            </h2>
            <p className="text-xs text-gray-400 mt-0.5">Groq client mocked; no live API calls</p>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 text-left">
                <th className="px-5 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  Test File
                </th>
                <th className="px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  Module
                </th>
                <th className="px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide text-right">
                  Tests
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {moduleGroups.map((group) => {
                const suites = UNIT_SUITES.filter((s) => s.module === group)
                const groupTotal = suites.reduce((s, x) => s + x.tests, 0)
                return (
                  <>
                    {suites.map((suite, i) => (
                      <tr key={suite.file} className="hover:bg-gray-50">
                        <td className="px-5 py-2 font-mono text-xs text-gray-700">{suite.file}</td>
                        <td className="px-4 py-2 text-xs text-gray-500">{i === 0 ? group : ''}</td>
                        <td className="px-4 py-2 text-right text-sm font-medium text-gray-800">
                          {suite.tests}
                        </td>
                      </tr>
                    ))}
                    <tr className="bg-gray-50">
                      <td className="px-5 py-1.5 text-xs text-gray-400 italic">{group} subtotal</td>
                      <td />
                      <td className="px-4 py-1.5 text-right text-xs font-semibold text-gray-600">
                        {groupTotal}
                      </td>
                    </tr>
                  </>
                )
              })}
            </tbody>
            <tfoot>
              <tr className="bg-indigo-50 border-t-2 border-indigo-200">
                <td className="px-5 py-2.5 text-sm font-bold text-indigo-800">Total</td>
                <td />
                <td className="px-4 py-2.5 text-right text-sm font-bold text-indigo-800">
                  {totalUnitTests}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* E2E test inventory */}
      <div className="mb-8 rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-2">
          <Globe className="h-4 w-4 text-purple-500" />
          <div>
            <h2 className="text-sm font-semibold text-gray-700">
              E2E Tests (Playwright) — {totalE2eTests} tests · 3 suites
            </h2>
            <p className="text-xs text-gray-400 mt-0.5">
              Covers UI pages, navigation, and full browser flows
            </p>
          </div>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 text-left">
              <th className="px-5 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                Suite
              </th>
              <th className="px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                Coverage
              </th>
              <th className="px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide text-right">
                Tests
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {E2E_SUITES.map((suite) => (
              <tr key={suite.file} className="hover:bg-gray-50">
                <td className="px-5 py-2.5 font-mono text-xs text-gray-700">{suite.file}</td>
                <td className="px-4 py-2.5 text-xs text-gray-500">{suite.description}</td>
                <td className="px-4 py-2.5 text-right text-sm font-medium text-gray-800">
                  {suite.tests}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="bg-purple-50 border-t-2 border-purple-200">
              <td className="px-5 py-2.5 text-sm font-bold text-purple-800">Total</td>
              <td />
              <td className="px-4 py-2.5 text-right text-sm font-bold text-purple-800">
                {totalE2eTests}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      {/* TDD red-green-refactor evidence */}
      <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-2">
          <GitBranch className="h-4 w-4 text-emerald-500" />
          <div>
            <h2 className="text-sm font-semibold text-gray-700">
              TDD Red → Green → Refactor Evidence
            </h2>
            <p className="text-xs text-gray-400 mt-0.5">
              {TDD_FEATURES.length} features built test-first — visible in git commit history
            </p>
          </div>
        </div>
        <div className="divide-y divide-gray-100">
          {TDD_FEATURES.map((f) => (
            <div key={f.feature} className="px-5 py-4">
              <p className="text-sm font-semibold text-gray-800 mb-2 flex items-center gap-1.5">
                <FileCode className="h-4 w-4 text-gray-400 shrink-0" />
                {f.feature}
              </p>
              <div className="grid sm:grid-cols-2 gap-2">
                <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2">
                  <p className="text-xs font-semibold text-red-600 mb-1">🔴 RED — test first</p>
                  <p className="font-mono text-xs text-red-800 break-all">{f.red}</p>
                </div>
                <div className="rounded-lg bg-emerald-50 border border-emerald-200 px-3 py-2">
                  <p className="text-xs font-semibold text-emerald-600 mb-1">
                    🟢 GREEN — implementation
                  </p>
                  <p className="font-mono text-xs text-emerald-800 break-all">{f.green}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
