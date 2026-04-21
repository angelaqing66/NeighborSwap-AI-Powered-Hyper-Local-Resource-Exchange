'use server'

// src/actions/trades.ts
// Server Actions for trade lifecycle management.

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { emitToRoom } from '@/lib/socket/emitter'
import { SOCKET_EVENTS } from '@/lib/socket'
import { VALID_TRANSITIONS } from '@/types/trades'
import type { TradeStatus, TransitionRole } from '@/types/trades'

export interface CreateTradeResult {
  error: string | null
  trade_id?: string
}

export async function createTradeAction(
  _prevState: CreateTradeResult,
  formData: FormData
): Promise<CreateTradeResult> {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'You must be signed in to request a swap.' }

  const item_id = formData.get('item_id')?.toString().trim() ?? ''
  if (!item_id) return { error: 'Item ID is required.' }

  const counterparty_id = formData.get('counterparty_id')?.toString().trim() ?? ''
  if (!counterparty_id) return { error: 'Provider ID is required.' }

  if (user.id === counterparty_id) return { error: 'You cannot swap with yourself.' }

  const { data, error } = await supabase
    .from('trades')
    .insert({ initiator_id: user.id, counterparty_id, item_id, status: 'pending_offer' })
    .select('id')
    .single()

  if (error) return { error: 'Failed to create trade. Please try again.' }

  const trade_id = (data as { id: string }).id
  redirect(`/chat/${trade_id}`)
  return { error: null, trade_id }
}

export interface UpdateTradeStatusResult {
  error: string | null
}

export async function updateTradeStatusAction(
  tradeId: string,
  newStatus: TradeStatus,
  reason?: string
): Promise<UpdateTradeStatusResult> {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated.' }

  const { data: trade } = await supabase
    .from('trades')
    .select('status, initiator_id, counterparty_id')
    .eq('id', tradeId)
    .single()

  if (!trade) return { error: 'Trade not found.' }

  const isInitiator = trade.initiator_id === user.id
  const isCounterparty = trade.counterparty_id === user.id
  if (!isInitiator && !isCounterparty) return { error: 'Not authorized.' }

  // Validate state machine transition
  const currentStatus = trade.status as TradeStatus
  const allowedTransitions = VALID_TRANSITIONS[currentStatus] ?? []
  const transition = allowedTransitions.find((t) => t.next === newStatus)

  if (!transition) {
    return { error: `Cannot transition from '${currentStatus}' to '${newStatus}'.` }
  }

  // Validate role permission for this specific transition
  const role: TransitionRole = isInitiator ? 'initiator' : 'counterparty'
  if (!transition.roles.includes(role)) {
    return { error: `Only the ${transition.roles.join(' or ')} can perform this transition.` }
  }

  // Build update payload; set lifecycle timestamps and optional reason fields
  const now = new Date().toISOString()
  const trimmedReason = reason?.trim() || undefined
  const updatePayload: Record<string, unknown> = { status: newStatus }
  if (newStatus === 'accepted') updatePayload.accepted_at = now
  if (newStatus === 'completed') updatePayload.completed_at = now
  if (newStatus === 'cancelled') updatePayload.cancelled_at = now
  if (newStatus === 'cancelled' && trimmedReason) updatePayload.cancellation_reason = trimmedReason
  if (newStatus === 'disputed' && trimmedReason) updatePayload.dispute_reason = trimmedReason

  const { error } = await supabase.from('trades').update(updatePayload).eq('id', tradeId)

  if (error) {
    console.error('[updateTradeStatusAction] trades update failed', {
      tradeId,
      newStatus,
      code: error.code,
      message: error.message,
      details: error.details,
      hint: error.hint,
    })
    return { error: `Failed to update trade status: ${error.message}` }
  }

  emitToRoom(`trade:${tradeId}`, SOCKET_EVENTS.tradeStatus(tradeId), {
    trade_id: tradeId,
    status: newStatus,
    updated_at: now,
  })

  // Insert a persistent system event message and deliver it to the chat
  // timeline for possession-transfer milestones and other key transitions.
  const systemEvent = SYSTEM_EVENTS[newStatus]
  if (systemEvent) {
    // Append the user-supplied reason (if any) so it appears in the chat card.
    const content = trimmedReason ? `${systemEvent.content}: ${trimmedReason}` : systemEvent.content

    const { error: msgError } = await supabase.from('messages').insert({
      trade_id: tradeId,
      sender_id: user.id,
      content,
      event_type: systemEvent.event_type,
      sent_at: now,
    })
    if (msgError) {
      console.error('[updateTradeStatusAction] system event insert failed', {
        tradeId,
        newStatus,
        code: msgError.code,
        message: msgError.message,
      })
    }

    emitToRoom(`trade:${tradeId}`, SOCKET_EVENTS.chatMessage(tradeId), {
      trade_id: tradeId,
      sender_id: user.id,
      content,
      event_type: systemEvent.event_type,
      sent_at: now,
    })
  }

  return { error: null }
}

// System event messages inserted into the chat when milestone transitions occur.
// Keyed by the new status.
const SYSTEM_EVENTS: Partial<Record<TradeStatus, { content: string; event_type: string }>> = {
  accepted: { content: 'Deal accepted', event_type: 'status:accepted' },
  in_progress: { content: 'Pickup confirmed', event_type: 'status:in_progress' },
  completed: { content: 'Return confirmed', event_type: 'status:completed' },
  cancelled: { content: 'Trade cancelled', event_type: 'status:cancelled' },
  disputed: { content: 'Dispute raised', event_type: 'status:disputed' },
}
