'use server'

// src/actions/messages.ts
// Server Actions for trade chat messages.

import { createClient } from '@/lib/supabase/server'
import { emitToRoom } from '@/lib/socket/emitter'
import { SOCKET_EVENTS } from '@/lib/socket'
import { runMessageSafety } from '@/lib/agents/safety'
import type { Message } from '@/types/messages'
import type { ModerationVerdict } from '@/types/trades'

export interface SendMessageResult {
  error: string | null
  message?: Message
  safety_flags?: {
    was_redacted: boolean
    has_phishing_link: boolean
    verdict: ModerationVerdict
  }
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

  // Run message safety scan — redacts PII and checks for phishing links.
  // Never blocks the overall flow on a Groq API failure (runMessageSafety
  // degrades to 'review' and returns the client-side pre-pass content).
  const safety = await runMessageSafety({
    trade_id: tradeId,
    sender_id: user.id,
    content: trimmed,
  })

  if (safety.verdict === 'block') {
    return {
      error:
        'Your message was blocked because it appears to contain a phishing link or malicious content.',
    }
  }

  // Store the redacted version so raw PII is never persisted.
  const contentToStore = safety.redacted_content

  const sent_at = new Date().toISOString()
  // Pre-generate the ID so we don't need .select().single() after insert.
  // .select().single() can return PGRST116 when the RETURNING rows get
  // filtered by the SELECT RLS policy even though the INSERT succeeded.
  const messageId = crypto.randomUUID()

  const { error } = await supabase
    .from('messages')
    .insert({
      id: messageId,
      trade_id: tradeId,
      sender_id: user.id,
      content: contentToStore,
      sent_at,
    })

  if (error) {
    console.error('[sendMessageAction] insert failed', {
      code: error.code,
      message: error.message,
      details: error.details,
      hint: error.hint,
    })
    return { error: 'Failed to send message. Please try again.' }
  }

  const message: Message = {
    id: messageId,
    trade_id: tradeId,
    sender_id: user.id,
    content: contentToStore,
    event_type: null,
    sent_at,
    created_at: sent_at,
  }

  // Emit to all clients in the trade room — includes both parties
  emitToRoom(`trade:${tradeId}`, SOCKET_EVENTS.chatMessage(tradeId), {
    id: messageId,
    trade_id: tradeId,
    sender_id: user.id,
    content: contentToStore,
    sent_at,
  })

  return {
    error: null,
    message,
    safety_flags: {
      was_redacted: contentToStore !== trimmed,
      has_phishing_link: safety.has_phishing_link,
      verdict: safety.verdict,
    },
  }
}
