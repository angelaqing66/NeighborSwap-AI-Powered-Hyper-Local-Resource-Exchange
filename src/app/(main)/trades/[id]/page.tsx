// src/app/(main)/trades/[id]/page.tsx
// Trade detail page — shows full trade info and scoring form for completed trades.

import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import {
  ArrowLeft,
  MessageSquare,
  Clock,
  CheckCircle,
  AlertTriangle,
  XCircle,
  ArrowRightLeft,
  Activity,
  CalendarCheck,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import TradeScoreForm from '@/components/TradeScoreForm'
import type { Trade, TradeStatus } from '@/types/trades'
import type { Review } from '@/types/reviews'

export const metadata: Metadata = {
  title: 'Trade Detail — NeighborSwap',
}

// ── Status display config ─────────────────────────────────────────────────────

const STATUS_CONFIG: Record<
  TradeStatus,
  { label: string; color: string; Icon: React.ElementType }
> = {
  pending_offer: {
    label: 'Pending offer',
    color: 'text-yellow-700 bg-yellow-50 border-yellow-200',
    Icon: Clock,
  },
  negotiating: {
    label: 'Negotiating',
    color: 'text-blue-700 bg-blue-50 border-blue-200',
    Icon: ArrowRightLeft,
  },
  accepted: {
    label: 'Accepted',
    color: 'text-green-700 bg-green-50 border-green-200',
    Icon: CheckCircle,
  },
  flagged: {
    label: 'Flagged',
    color: 'text-red-700 bg-red-50 border-red-200',
    Icon: AlertTriangle,
  },
  scheduled: {
    label: 'Scheduled',
    color: 'text-indigo-700 bg-indigo-50 border-indigo-200',
    Icon: CalendarCheck,
  },
  in_progress: {
    label: 'In progress',
    color: 'text-purple-700 bg-purple-50 border-purple-200',
    Icon: Activity,
  },
  completed: {
    label: 'Completed',
    color: 'text-gray-700 bg-gray-50 border-gray-200',
    Icon: CheckCircle,
  },
  cancelled: {
    label: 'Cancelled',
    color: 'text-gray-500 bg-gray-50 border-gray-200',
    Icon: XCircle,
  },
  disputed: {
    label: 'Disputed',
    color: 'text-orange-700 bg-orange-50 border-orange-200',
    Icon: AlertTriangle,
  },
}

function StatusBadge({ status }: { status: TradeStatus }) {
  const { label, color, Icon } = STATUS_CONFIG[status] ?? STATUS_CONFIG.pending_offer
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm font-medium ${color}`}
    >
      <Icon className="h-3.5 w-3.5" aria-hidden />
      {label}
    </span>
  )
}

function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5 sm:flex-row sm:items-start sm:gap-4">
      <dt className="w-36 shrink-0 text-xs font-medium text-gray-500">{label}</dt>
      <dd className="text-sm text-gray-800">{value}</dd>
    </div>
  )
}

function fmt(iso: string | null) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function TradeDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Fetch trade
  const { data: rawTrade } = await supabase.from('trades').select('*').eq('id', id).single()
  if (!rawTrade) notFound()

  const trade = rawTrade as Trade

  // Ensure the current user is a party to this trade
  if (trade.initiator_id !== user.id && trade.counterparty_id !== user.id) notFound()

  // Fetch item title and other party's name in parallel
  const otherPartyId = trade.initiator_id === user.id ? trade.counterparty_id : trade.initiator_id

  const [itemResult, otherPartyResult, myReviewResult] = await Promise.all([
    supabase.from('items').select('title').eq('id', trade.item_id).single(),
    supabase.from('users').select('full_name').eq('id', otherPartyId).single(),
    // Check if the current user already reviewed this trade
    supabase
      .from('reviews')
      .select('score, comment, created_at')
      .eq('trade_id', id)
      .eq('reviewer_id', user.id)
      .maybeSingle(),
  ])

  const itemTitle = (itemResult.data as { title: string } | null)?.title ?? 'Unknown item'
  const otherPartyName =
    (otherPartyResult.data as { full_name: string | null } | null)?.full_name ?? 'Unknown user'
  const myReview = myReviewResult.data as Review | null

  const role = trade.initiator_id === user.id ? 'Initiator' : 'Counterparty'
  const isCompleted = trade.status === 'completed'

  return (
    <div className="space-y-6">
      {/* Back link */}
      <Link
        href="/trades"
        className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 transition-colors"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden />
        My trades
      </Link>

      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900">
            Trade #{trade.id.slice(0, 8).toUpperCase()}
          </h1>
          <p className="mt-0.5 text-sm text-gray-500">{itemTitle}</p>
        </div>
        <StatusBadge status={trade.status} />
      </div>

      {/* Details card */}
      <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        <dl className="space-y-3">
          <DetailRow label="Your role" value={role} />
          <DetailRow label="Other party" value={otherPartyName} />
          {trade.agreed_terms && <DetailRow label="Agreed terms" value={trade.agreed_terms} />}
          {trade.vibe_score !== null && (
            <DetailRow
              label="Vibe score"
              value={<span className="font-semibold text-indigo-600">{trade.vibe_score}/100</span>}
            />
          )}
          <DetailRow label="Created" value={fmt(trade.created_at)} />
          {trade.accepted_at && <DetailRow label="Accepted" value={fmt(trade.accepted_at)} />}
          {trade.scheduled_at && <DetailRow label="Scheduled" value={fmt(trade.scheduled_at)} />}
          {trade.completed_at && <DetailRow label="Completed" value={fmt(trade.completed_at)} />}
          {trade.cancelled_at && <DetailRow label="Cancelled" value={fmt(trade.cancelled_at)} />}
          {trade.cancellation_reason && (
            <DetailRow label="Cancel reason" value={trade.cancellation_reason} />
          )}
          {trade.dispute_reason && (
            <DetailRow label="Dispute reason" value={trade.dispute_reason} />
          )}
        </dl>
      </div>

      {/* Chat link */}
      <Link
        href={`/chat/${trade.id}`}
        className="flex items-center justify-center gap-2 rounded-xl border border-gray-300 bg-white py-3 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors shadow-sm"
      >
        <MessageSquare className="h-4 w-4" aria-hidden />
        Open chat for this trade
      </Link>

      {/* Score section — only for completed trades */}
      {isCompleted && (
        <section>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500">
            Your review
          </h2>

          {myReview ? (
            /* Already reviewed — show the submitted score */
            <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">
                  You scored this trade on{' '}
                  {new Date(myReview.created_at).toLocaleDateString(undefined, {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                  })}
                </span>
                <span className="text-2xl font-bold text-green-600">
                  {myReview.score}
                  <span className="text-sm font-normal text-gray-400">/100</span>
                </span>
              </div>
              {myReview.comment && (
                <p className="mt-3 rounded-lg bg-gray-50 px-4 py-3 text-sm text-gray-700 italic">
                  &ldquo;{myReview.comment}&rdquo;
                </p>
              )}
            </div>
          ) : (
            /* Not yet reviewed — show the form */
            <TradeScoreForm tradeId={trade.id} />
          )}
        </section>
      )}
    </div>
  )
}
