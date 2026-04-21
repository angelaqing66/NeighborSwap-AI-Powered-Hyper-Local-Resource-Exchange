'use client'

import { useState, useTransition } from 'react'
import { CheckCircle, Clock, ArrowRightLeft, AlertTriangle, XCircle, Loader2 } from 'lucide-react'
import { useTrade } from '@/hooks/useTrade'
import { updateTradeStatusAction } from '@/actions/trades'
import type { TradeStatus } from '@/types/trades'

interface TradeStatusPanelProps {
  tradeId: string
  initialStatus: TradeStatus
  currentUserId: string
  initiatorId: string
  counterpartyId: string
}

interface Transition {
  next: TradeStatus
  label: string
  forInitiator: boolean
  forCounterparty: boolean
  danger: boolean
}

const TRANSITIONS: Partial<Record<TradeStatus, Transition[]>> = {
  pending_offer: [
    {
      next: 'negotiating',
      label: 'Start negotiating',
      forInitiator: false,
      forCounterparty: true,
      danger: false,
    },
    { next: 'cancelled', label: 'Cancel', forInitiator: true, forCounterparty: true, danger: true },
  ],
  negotiating: [
    {
      next: 'accepted',
      label: 'Accept deal',
      forInitiator: true,
      forCounterparty: true,
      danger: false,
    },
    { next: 'cancelled', label: 'Cancel', forInitiator: true, forCounterparty: true, danger: true },
  ],
  accepted: [
    {
      next: 'in_progress',
      label: 'Mark in progress',
      forInitiator: true,
      forCounterparty: true,
      danger: false,
    },
    { next: 'disputed', label: 'Dispute', forInitiator: true, forCounterparty: true, danger: true },
  ],
  scheduled: [
    {
      next: 'in_progress',
      label: 'Mark in progress',
      forInitiator: true,
      forCounterparty: true,
      danger: false,
    },
  ],
  in_progress: [
    {
      next: 'completed',
      label: 'Mark completed',
      forInitiator: true,
      forCounterparty: true,
      danger: false,
    },
    { next: 'disputed', label: 'Dispute', forInitiator: true, forCounterparty: true, danger: true },
  ],
}

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
    Icon: Clock,
  },
  in_progress: {
    label: 'In progress',
    color: 'text-purple-700 bg-purple-50 border-purple-200',
    Icon: ArrowRightLeft,
  },
  completed: {
    label: 'Completed',
    color: 'text-gray-600 bg-gray-50 border-gray-200',
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

export function getAvailableTransitions(
  status: TradeStatus,
  isInitiator: boolean,
  isCounterparty: boolean
): Transition[] {
  return (TRANSITIONS[status] ?? []).filter(
    (t) => (isInitiator && t.forInitiator) || (isCounterparty && t.forCounterparty)
  )
}

export default function TradeStatusPanel({
  tradeId,
  initialStatus,
  currentUserId,
  initiatorId,
  counterpartyId,
}: TradeStatusPanelProps) {
  const status = useTrade(tradeId, initialStatus)
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const isInitiator = currentUserId === initiatorId
  const isCounterparty = currentUserId === counterpartyId

  const { label, color, Icon } = STATUS_CONFIG[status] ?? STATUS_CONFIG.pending_offer

  const availableTransitions = getAvailableTransitions(status, isInitiator, isCounterparty)

  function handleTransition(next: TradeStatus) {
    setError(null)
    startTransition(async () => {
      const result = await updateTradeStatusAction(tradeId, next)
      if (result.error) setError(result.error)
    })
  }

  return (
    <div className="flex items-center gap-3 border-b border-gray-100 bg-gray-50 px-4 py-2">
      <span
        className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium ${color}`}
      >
        <Icon className="h-3 w-3" aria-hidden />
        {label}
      </span>

      {availableTransitions.length > 0 && (
        <div className="flex items-center gap-2">
          {availableTransitions.map((t) => (
            <button
              key={t.next}
              onClick={() => handleTransition(t.next)}
              disabled={isPending}
              className={`inline-flex items-center gap-1 rounded-lg border px-2.5 py-1 text-xs font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
                t.danger
                  ? 'border-red-200 text-red-600 hover:bg-red-50'
                  : 'border-green-200 text-green-700 hover:bg-green-50'
              }`}
            >
              {isPending && <Loader2 className="h-3 w-3 animate-spin" aria-hidden />}
              {t.label}
            </button>
          ))}
        </div>
      )}

      {error && (
        <p className="ml-auto text-xs text-red-600" role="alert">
          {error}
        </p>
      )}
    </div>
  )
}
