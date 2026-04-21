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
  requiresConfirmation: boolean
  requiresReason: boolean // shows a reason textarea before confirming
}

// Text shown in the inline confirmation prompt before executing a
// possession-transfer transition.
const CONFIRMATION_PROMPTS: Partial<Record<TradeStatus, string>> = {
  in_progress:
    'This records that the item has been picked up and you are now responsible for its safe return.',
  completed: 'This records that the item has been returned to the provider.',
}

// Placeholder text for the reason textarea shown on cancel / dispute flows.
const REASON_PLACEHOLDERS: Partial<Record<TradeStatus, string>> = {
  cancelled: 'Why are you cancelling? (optional)',
  disputed: 'Describe the issue… (optional)',
}

const TRANSITIONS: Partial<Record<TradeStatus, Transition[]>> = {
  pending_offer: [
    {
      next: 'negotiating',
      label: 'Start Inquiry',
      forInitiator: false,
      forCounterparty: true,
      danger: false,
      requiresConfirmation: false,
      requiresReason: false,
    },
    {
      next: 'cancelled',
      label: 'Cancel',
      forInitiator: true,
      forCounterparty: true,
      danger: true,
      requiresConfirmation: true,
      requiresReason: true,
    },
  ],
  negotiating: [
    {
      next: 'accepted',
      label: 'Request Swap',
      forInitiator: true,
      forCounterparty: true,
      danger: false,
      requiresConfirmation: false,
      requiresReason: false,
    },
    {
      next: 'cancelled',
      label: 'Cancel',
      forInitiator: true,
      forCounterparty: true,
      danger: true,
      requiresConfirmation: true,
      requiresReason: true,
    },
  ],
  accepted: [
    {
      next: 'in_progress',
      label: 'Confirm Pickup',
      forInitiator: true,
      forCounterparty: false,
      danger: false,
      requiresConfirmation: true,
      requiresReason: false,
    },
    {
      next: 'disputed',
      label: 'Dispute',
      forInitiator: true,
      forCounterparty: true,
      danger: true,
      requiresConfirmation: true,
      requiresReason: true,
    },
  ],
  scheduled: [
    {
      next: 'in_progress',
      label: 'Confirm Pickup',
      forInitiator: true,
      forCounterparty: false,
      danger: false,
      requiresConfirmation: true,
      requiresReason: false,
    },
  ],
  in_progress: [
    {
      next: 'completed',
      label: 'Confirm Return',
      forInitiator: false,
      forCounterparty: true,
      danger: false,
      requiresConfirmation: true,
      requiresReason: false,
    },
    {
      next: 'disputed',
      label: 'Dispute',
      forInitiator: true,
      forCounterparty: true,
      danger: true,
      requiresConfirmation: true,
      requiresReason: true,
    },
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
  const [confirmingNext, setConfirmingNext] = useState<TradeStatus | null>(null)
  const [reasonText, setReasonText] = useState('')

  const isInitiator = currentUserId === initiatorId
  const isCounterparty = currentUserId === counterpartyId

  const { label, color, Icon } = STATUS_CONFIG[status] ?? STATUS_CONFIG.pending_offer

  const availableTransitions = getAvailableTransitions(status, isInitiator, isCounterparty)

  const confirmingTransition = availableTransitions.find((t) => t.next === confirmingNext)
  const confirmingNeedsReason = confirmingTransition?.requiresReason ?? false

  function handleTransitionClick(t: Transition) {
    setError(null)
    if (t.requiresConfirmation || t.requiresReason) {
      setConfirmingNext(t.next)
    } else {
      executeTransition(t.next)
    }
  }

  function handleConfirm() {
    if (confirmingNext) {
      executeTransition(confirmingNext, confirmingNeedsReason ? reasonText : undefined)
    }
  }

  function handleCancelConfirm() {
    setConfirmingNext(null)
    setReasonText('')
  }

  function executeTransition(next: TradeStatus, reason?: string) {
    setConfirmingNext(null)
    setReasonText('')
    startTransition(async () => {
      const result = await updateTradeStatusAction(tradeId, next, reason?.trim() || undefined)
      if (result.error) setError(result.error)
    })
  }

  return (
    <div className="border-b border-gray-100 bg-gray-50 px-4 py-2">
      <div className="flex items-center gap-3">
        {/* Status badge */}
        <span
          className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium ${color}`}
        >
          <Icon className="h-3 w-3" aria-hidden />
          {label}
        </span>

        {/* Inline confirmation prompt or action buttons */}
        {confirmingNext ? (
          <div className="min-w-0 flex-1">
            {confirmingNeedsReason ? (
              // Reason-input flow: stacked layout with optional textarea
              <div className="flex flex-col gap-1.5">
                <textarea
                  value={reasonText}
                  onChange={(e) => setReasonText(e.target.value)}
                  placeholder={REASON_PLACEHOLDERS[confirmingNext] ?? 'Add a reason (optional)…'}
                  disabled={isPending}
                  rows={2}
                  className="w-full resize-none rounded-lg border border-gray-200 px-2.5 py-1.5 text-xs text-gray-700 placeholder-gray-400 focus:border-green-500 focus:outline-none focus:ring-1 focus:ring-green-500 disabled:opacity-50"
                />
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={handleConfirm}
                    disabled={isPending}
                    className="inline-flex items-center gap-1 rounded-lg border border-red-200 bg-red-50 px-2.5 py-1 text-xs font-medium text-red-700 transition-colors hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {isPending && <Loader2 className="h-3 w-3 animate-spin" aria-hidden />}
                    Confirm
                  </button>
                  <button
                    onClick={handleCancelConfirm}
                    disabled={isPending}
                    className="rounded-lg border border-gray-200 px-2.5 py-1 text-xs font-medium text-gray-500 transition-colors hover:bg-gray-100 disabled:opacity-50"
                  >
                    Back
                  </button>
                </div>
              </div>
            ) : (
              // Possession-confirmation flow: single-line prompt with confirm/back
              <div className="flex items-center gap-2">
                <p className="min-w-0 truncate text-xs text-gray-600">
                  {CONFIRMATION_PROMPTS[confirmingNext] ?? 'Are you sure?'}
                </p>
                <div className="flex shrink-0 items-center gap-1.5">
                  <button
                    onClick={handleConfirm}
                    disabled={isPending}
                    className="inline-flex items-center gap-1 rounded-lg border border-green-300 bg-green-50 px-2.5 py-1 text-xs font-medium text-green-700 transition-colors hover:bg-green-100 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {isPending && <Loader2 className="h-3 w-3 animate-spin" aria-hidden />}
                    Confirm
                  </button>
                  <button
                    onClick={handleCancelConfirm}
                    disabled={isPending}
                    className="rounded-lg border border-gray-200 px-2.5 py-1 text-xs font-medium text-gray-500 transition-colors hover:bg-gray-100 disabled:opacity-50"
                  >
                    Back
                  </button>
                </div>
              </div>
            )}
          </div>
        ) : (
          availableTransitions.length > 0 && (
            <div className="flex items-center gap-2">
              {availableTransitions.map((t) => (
                <button
                  key={t.next}
                  onClick={() => handleTransitionClick(t)}
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
          )
        )}

        {error && (
          <p className="ml-auto shrink-0 text-xs text-red-600" role="alert">
            {error}
          </p>
        )}
      </div>
    </div>
  )
}
