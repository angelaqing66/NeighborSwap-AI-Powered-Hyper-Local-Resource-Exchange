'use client'

// src/components/listings/RequestSwapButton.tsx
// Client component — submits a trade offer via createTradeAction.

import { useActionState, useTransition } from 'react'
import { ArrowRightLeft } from 'lucide-react'
import { createTradeAction, type CreateTradeResult } from '@/actions/trades'

interface RequestSwapButtonProps {
  itemId: string
  counterpartyId: string
}

const initialState: CreateTradeResult = { error: null }

export default function RequestSwapButton({ itemId, counterpartyId }: RequestSwapButtonProps) {
  const [state, formAction] = useActionState(createTradeAction, initialState)
  const [isPending, startTransition] = useTransition()

  function handleSubmit(formData: FormData) {
    startTransition(() => formAction(formData))
  }

  return (
    <div>
      <form action={handleSubmit}>
        <input type="hidden" name="item_id" value={itemId} />
        <input type="hidden" name="counterparty_id" value={counterpartyId} />
        <button
          type="submit"
          disabled={isPending}
          className="inline-flex items-center gap-2 rounded-lg bg-green-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-60"
        >
          <ArrowRightLeft className="h-4 w-4" aria-hidden />
          {isPending ? 'Requesting…' : 'Request Swap'}
        </button>
      </form>
      {state.error && (
        <p className="mt-2 text-sm text-red-600" role="alert">
          {state.error}
        </p>
      )}
    </div>
  )
}
