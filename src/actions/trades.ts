'use server'

// src/actions/trades.ts
// Server Actions for trade lifecycle management.

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

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
