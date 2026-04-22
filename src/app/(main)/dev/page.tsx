// src/app/(main)/dev/page.tsx
// Developer dashboard — platform-wide statistics.
// Server component: no 'use client'.

import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import {
  Users,
  ArrowLeftRight,
  Activity,
  Clock,
  MessageSquare,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Shield,
  Loader,
  CalendarCheck,
} from 'lucide-react'
import type { TradeStatus } from '@/types/trades'
import { computeStatusBreakdown, computeActiveCount } from '@/lib/getDevStats'

export const metadata: Metadata = {
  title: 'Developer Dashboard — NeighborSwap',
}

// ── Sub-components ────────────────────────────────────────────────────────────

interface StatCardProps {
  icon: React.ReactNode
  label: string
  value: number
  description?: string
  accent?: 'indigo' | 'emerald' | 'amber' | 'red' | 'gray'
}

function StatCard({ icon, label, value, description, accent = 'gray' }: StatCardProps) {
  const accentMap: Record<string, string> = {
    indigo: 'text-indigo-600',
    emerald: 'text-emerald-600',
    amber: 'text-amber-600',
    red: 'text-red-600',
    gray: 'text-gray-800',
  }

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
      <div className="flex items-center gap-2 text-gray-500">{icon}</div>
      <p className={`text-3xl font-bold ${accentMap[accent]}`}>{value.toLocaleString()}</p>
      <div>
        <p className="text-sm font-medium text-gray-700">{label}</p>
        {description && <p className="mt-0.5 text-xs text-gray-400">{description}</p>}
      </div>
    </div>
  )
}

interface MiniCardProps {
  status: string
  count: number
}

function MiniCard({ status, count }: MiniCardProps) {
  const displayMap: Record<string, { label: string; color: string }> = {
    pending_offer: {
      label: 'Pending offer',
      color: 'bg-yellow-50 text-yellow-700 border-yellow-200',
    },
    negotiating: { label: 'Negotiating', color: 'bg-blue-50 text-blue-700 border-blue-200' },
    accepted: { label: 'Accepted', color: 'bg-indigo-50 text-indigo-700 border-indigo-200' },
    scheduled: { label: 'Scheduled', color: 'bg-purple-50 text-purple-700 border-purple-200' },
    in_progress: {
      label: 'In progress',
      color: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    },
    completed: { label: 'Completed', color: 'bg-green-50 text-green-700 border-green-200' },
    cancelled: { label: 'Cancelled', color: 'bg-gray-50 text-gray-600 border-gray-200' },
    disputed: { label: 'Disputed', color: 'bg-orange-50 text-orange-700 border-orange-200' },
    flagged: { label: 'Flagged', color: 'bg-red-50 text-red-700 border-red-200' },
  }

  const meta = displayMap[status] ?? {
    label: status,
    color: 'bg-gray-50 text-gray-600 border-gray-200',
  }

  return (
    <div className={`rounded-lg border px-4 py-3 ${meta.color}`}>
      <p className="text-lg font-bold">{count.toLocaleString()}</p>
      <p className="mt-0.5 text-xs font-medium">{meta.label}</p>
    </div>
  )
}

// ── All known statuses in display order ──────────────────────────────────────
const ALL_STATUSES: TradeStatus[] = [
  'pending_offer',
  'negotiating',
  'accepted',
  'scheduled',
  'in_progress',
  'completed',
  'cancelled',
  'disputed',
  'flagged',
]

// ── Page ─────────────────────────────────────────────────────────────────────

export default async function DevPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  // Fetch user count and all trade statuses in parallel.
  const [userResult, tradeResult] = await Promise.all([
    supabase.from('users').select('*', { count: 'exact', head: true }),
    supabase.from('trades').select('status'),
  ])

  const userCount = userResult.count ?? 0
  const trades = (tradeResult.data ?? []) as { status: string }[]

  const breakdown = computeStatusBreakdown(trades)
  const totalTrades = trades.length
  const activeCount = computeActiveCount(breakdown)

  return (
    <div>
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Developer Dashboard</h1>
        <p className="mt-1 text-sm text-gray-500">Platform statistics — live from Supabase</p>
      </div>

      {/* Top summary cards */}
      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard
          icon={<Users className="h-5 w-5" aria-hidden />}
          label="Total users"
          value={userCount}
          description="Registered accounts"
          accent="indigo"
        />
        <StatCard
          icon={<ArrowLeftRight className="h-5 w-5" aria-hidden />}
          label="Total trades"
          value={totalTrades}
          description="All time across all statuses"
          accent="gray"
        />
        <StatCard
          icon={<Activity className="h-5 w-5" aria-hidden />}
          label="Active trades"
          value={activeCount}
          description="Accepted + scheduled + in progress"
          accent="emerald"
        />
      </div>

      {/* Status breakdown */}
      <div className="mt-8">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500">
          Trades by status
        </h2>
        <div className="grid gap-3 grid-cols-3 sm:grid-cols-4 lg:grid-cols-5">
          {ALL_STATUSES.map((status) => (
            <MiniCard key={status} status={status} count={breakdown[status] ?? 0} />
          ))}
        </div>
      </div>

      {/* Legend / icon key */}
      <div className="mt-8 rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        <h2 className="mb-4 text-sm font-semibold text-gray-700">Status icon reference</h2>
        <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 text-xs text-gray-600">
          {[
            {
              icon: <Clock className="h-3.5 w-3.5 text-yellow-500" />,
              label: 'pending_offer',
              desc: 'Offer sent, awaiting response',
            },
            {
              icon: <MessageSquare className="h-3.5 w-3.5 text-blue-500" />,
              label: 'negotiating',
              desc: 'Terms being refined via chat',
            },
            {
              icon: <CheckCircle className="h-3.5 w-3.5 text-indigo-500" />,
              label: 'accepted',
              desc: 'Both parties agreed',
            },
            {
              icon: <CalendarCheck className="h-3.5 w-3.5 text-purple-500" />,
              label: 'scheduled',
              desc: 'Logistics confirmed',
            },
            {
              icon: <Loader className="h-3.5 w-3.5 text-emerald-500" />,
              label: 'in_progress',
              desc: 'Exchange underway',
            },
            {
              icon: <CheckCircle className="h-3.5 w-3.5 text-green-500" />,
              label: 'completed',
              desc: 'Successful exchange',
            },
            {
              icon: <XCircle className="h-3.5 w-3.5 text-gray-400" />,
              label: 'cancelled',
              desc: 'Withdrawn before completion',
            },
            {
              icon: <AlertTriangle className="h-3.5 w-3.5 text-orange-500" />,
              label: 'disputed',
              desc: 'Escalated for review',
            },
            {
              icon: <Shield className="h-3.5 w-3.5 text-red-500" />,
              label: 'flagged',
              desc: 'Safety agent blocked',
            },
          ].map(({ icon, label, desc }) => (
            <div key={label} className="flex items-start gap-2">
              <span className="mt-0.5 shrink-0" aria-hidden>
                {icon}
              </span>
              <div>
                <span className="font-mono font-medium text-gray-800">{label}</span>
                <p className="text-gray-400">{desc}</p>
              </div>
            </div>
          ))}
        </dl>
      </div>
    </div>
  )
}
