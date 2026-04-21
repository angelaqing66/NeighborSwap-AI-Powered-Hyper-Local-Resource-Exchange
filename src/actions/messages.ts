'use server'

// src/actions/messages.ts
// Server Actions for trade chat messages.

import { createClient } from '@/lib/supabase/server'
import { emitToRoom } from '@/lib/socket/emitter'
import { SOCKET_EVENTS } from '@/lib/socket'
import type { Message } from '@/types/messages'

export interface SendMessageResult {
  error: string | null
  message?: Message
}

export async function sendMessageAction(
  tradeId: string,
  content: string
): Promise<SendMessageResult> {
  const trimmed = content.trim()
  if (!trimmed) return { error: 'Message cannot be empty.' }
  if (trimmed.length > 2000) return { error: 'Message is too long (max 2000 characters).' }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'You must be signed in.' }

  // Verify the caller is a party to this trade (authorization check)
  const { data: trade } = await supabase
    .from('trades')
    .select('initiator_id, counterparty_id')
    .eq('id', tradeId)
    .single()

  if (!trade) return { error: 'Trade not found.' }
  if (trade.initiator_id !== user.id && trade.counterparty_id !== user.id) {
    return { error: 'You are not a party to this trade.' }
  }

  const sent_at = new Date().toISOString()
  const { data, error } = await supabase
    .from('messages')
    .insert({ trade_id: tradeId, sender_id: user.id, content: trimmed, sent_at })
    .select()
    .single()

  if (error) return { error: 'Failed to send message. Please try again.' }

  const message = data as Message

  // Emit to all clients in the trade room — includes both parties
  emitToRoom(`trade:${tradeId}`, SOCKET_EVENTS.chatMessage(tradeId), {
    id: message.id,
    trade_id: tradeId,
    sender_id: user.id,
    content: trimmed,
    sent_at,
  })

  return { error: null, message }
}
