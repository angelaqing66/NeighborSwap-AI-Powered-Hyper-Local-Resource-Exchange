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
  newStatus: TradeStatus
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

  // Build update payload; set lifecycle timestamps for key milestones
  const now = new Date().toISOString()
  const updatePayload: Record<string, unknown> = { status: newStatus }
  if (newStatus === 'accepted') updatePayload.accepted_at = now
  if (newStatus === 'completed') updatePayload.completed_at = now
  if (newStatus === 'cancelled') updatePayload.cancelled_at = now

  const { error } = await supabase.from('trades').update(updatePayload).eq('id', tradeId)

  if (error) return { error: 'Failed to update trade status.' }

  emitToRoom(`trade:${tradeId}`, SOCKET_EVENTS.tradeStatus(tradeId), {
    trade_id: tradeId,
    status: newStatus,
    updated_at: now,
  })

  return { error: null }
}
