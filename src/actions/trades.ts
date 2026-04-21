'use server'

// src/actions/trades.ts
// Server Actions for trade lifecycle management.

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { emitToRoom } from '@/lib/socket/emitter'
import { SOCKET_EVENTS } from '@/lib/socket'
import type { TradeStatus } from '@/types/trades'

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

  if (error) return { error: 'Failed to create trade. Please try again.' }

  const trade_id = (data as Array<{ id: string }> | null)?.[0]?.id
  redirect('/trades')
  return { error: null, trade_id }
}

export interface UpdateTradeStatusResult {
  error: string | null
}

export async function updateTradeStatusAction(
  tradeId: string,
  status: TradeStatus
): Promise<UpdateTradeStatusResult> {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated.' }

  const { data: trade } = await supabase
    .from('trades')
    .select('initiator_id, counterparty_id')
    .eq('id', tradeId)
    .single()

  if (!trade) return { error: 'Trade not found.' }
  if (trade.initiator_id !== user.id && trade.counterparty_id !== user.id) {
    return { error: 'Not authorized.' }
  }

  const updated_at = new Date().toISOString()
  const { error } = await supabase.from('trades').update({ status, updated_at }).eq('id', tradeId)

  if (error) return { error: 'Failed to update trade status.' }

  emitToRoom(`trade:${tradeId}`, SOCKET_EVENTS.tradeStatus(tradeId), {
    trade_id: tradeId,
    status,
    updated_at,
  })

  return { error: null }
}
