// src/app/(main)/trades/page.tsx
// Trades dashboard — shows the current user's active and completed trades.

import type { Metadata } from 'next'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { ArrowRightLeft, Clock, CheckCircle, AlertTriangle, XCircle } from 'lucide-react'
import type { Trade, TradeStatus } from '@/types/trades'

export const metadata: Metadata = {
  title: 'My Trades — NeighborSwap',
}

const STATUS_CONFIG: Record<
  TradeStatus,
  { label: string; color: string; Icon: React.ElementType }
> = {
  pending_offer: { label: 'Pending offer', color: 'text-yellow-600 bg-yellow-50', Icon: Clock },
  negotiating: { label: 'Negotiating', color: 'text-blue-600 bg-blue-50', Icon: ArrowRightLeft },
  accepted: { label: 'Accepted', color: 'text-green-600 bg-green-50', Icon: CheckCircle },
  flagged: { label: 'Flagged', color: 'text-red-600 bg-red-50', Icon: AlertTriangle },
  scheduled: { label: 'Scheduled', color: 'text-indigo-600 bg-indigo-50', Icon: Clock },
  in_progress: {
    label: 'In progress',
    color: 'text-purple-600 bg-purple-50',
    Icon: ArrowRightLeft,
  },
  completed: { label: 'Completed', color: 'text-gray-600 bg-gray-50', Icon: CheckCircle },
  cancelled: { label: 'Cancelled', color: 'text-gray-400 bg-gray-50', Icon: XCircle },
  disputed: { label: 'Disputed', color: 'text-orange-600 bg-orange-50', Icon: AlertTriangle },
}

function StatusBadge({ status }: { status: TradeStatus }) {
  const { label, color, Icon } = STATUS_CONFIG[status] ?? STATUS_CONFIG.pending_offer
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${color}`}
    >
      <Icon className="h-3 w-3" aria-hidden />
      {label}
    </span>
  )
}

export default async function TradesPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: trades, error } = await supabase
    .from('trades')
    .select('*')
    .or(`initiator_id.eq.${user.id},counterparty_id.eq.${user.id}`)
    .order('updated_at', { ascending: false })

  if (error) {
    return <p className="text-sm text-red-600">Could not load trades. Please try again later.</p>
  }

  const items = (trades ?? []) as Trade[]
  const HISTORY_STATUSES: TradeStatus[] = ['completed', 'cancelled', 'disputed', 'flagged']
  const active = items.filter((t) => !HISTORY_STATUSES.includes(t.status))
  const history = items.filter((t) => HISTORY_STATUSES.includes(t.status))

  return (
    <>
      <h1 className="mb-6 text-2xl font-bold text-gray-900">My trades</h1>

      {items.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-300 bg-white py-16 text-center">
          <ArrowRightLeft className="mx-auto mb-3 h-10 w-10 text-gray-300" />
          <p className="text-sm font-medium text-gray-500">No trades yet.</p>
          <p className="mt-1 text-xs text-gray-400">
            Browse listings and make an offer to start trading.
          </p>
        </div>
      ) : (
        <div className="space-y-8">
          {active.length > 0 && (
            <section>
              <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500">
                Active ({active.length})
              </h2>
              <ul className="space-y-3">
                {active.map((trade) => (
                  <TradeRow key={trade.id} trade={trade} userId={user.id} />
                ))}
              </ul>
            </section>
          )}

          {history.length > 0 && (
            <section>
              <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500">
                History ({history.length})
              </h2>
              <ul className="space-y-3">
                {history.map((trade) => (
                  <TradeRow key={trade.id} trade={trade} userId={user.id} />
                ))}
              </ul>
            </section>
          )}
        </div>
      )}
    </>
  )
}

function TradeRow({ trade, userId }: { trade: Trade; userId: string }) {
  const role = trade.initiator_id === userId ? 'Initiator' : 'Counterparty'
  const updatedAt = new Date(trade.updated_at).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })

  return (
    <li>
      <Link
        href={`/trades/${trade.id}`}
        className="flex items-center justify-between rounded-xl border border-gray-200 bg-white px-4 py-3 shadow-sm hover:border-gray-300 hover:bg-gray-50 transition-colors"
      >
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-gray-900">
            Trade #{trade.id.slice(0, 8).toUpperCase()}
          </p>
          <p className="mt-0.5 text-xs text-gray-400">
            {role} · Updated {updatedAt}
          </p>
          {trade.vibe_score !== null && (
            <p className="mt-0.5 text-xs text-indigo-500">Vibe score: {trade.vibe_score}/100</p>
          )}
        </div>
        <StatusBadge status={trade.status} />
      </Link>
    </li>
  )
}
