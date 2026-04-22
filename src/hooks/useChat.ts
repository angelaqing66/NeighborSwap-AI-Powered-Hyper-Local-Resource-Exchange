'use client'

// src/hooks/useChat.ts
// Subscribes to real-time chat messages for a trade room.
//
// Primary path: Supabase Realtime (postgres_changes on messages table).
// Works on all deployments including Vercel — no custom server needed.
//
// Secondary path: Socket.io — active when server.ts is running locally
// and emits after each DB write.

import { useEffect, useState } from 'react'
import { useSocket } from './useSocket'
import { createClient } from '@/lib/supabase/client'
import { SOCKET_EVENTS } from '@/lib/socket'
import type { ChatMessagePayload } from '@/lib/socket'
import type { Message } from '@/types/messages'

type LivePayload = ChatMessagePayload & { id?: string }

function appendMessage(prev: Message[], msg: Message): Message[] {
  if (prev.some((m) => m.id === msg.id)) return prev
  return [...prev, msg]
}

export function useChat(tradeId: string, initialMessages: Message[] = []): Message[] {
  const socket = useSocket()
  const [messages, setMessages] = useState<Message[]>(initialMessages)

  // ── Supabase Realtime (primary) ────────────────────────────────────────────
  useEffect(() => {
    const supabase = createClient()
    const channel = supabase
      .channel(`chat-messages-${tradeId}-${crypto.randomUUID()}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `trade_id=eq.${tradeId}`,
        },
        (payload) => {
          const row = payload.new as {
            id: string
            trade_id: string
            sender_id: string
            content: string
            event_type: string | null
            sent_at: string
            created_at: string
          }
          setMessages((prev) =>
            appendMessage(prev, {
              id: row.id,
              trade_id: row.trade_id,
              sender_id: row.sender_id,
              content: row.content,
              event_type: row.event_type,
              sent_at: row.sent_at,
              created_at: row.created_at,
            })
          )
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [tradeId])

  // ── Socket.io (secondary) ──────────────────────────────────────────────────
  useEffect(() => {
    if (!socket) return

    socket.emit('join_trade', tradeId)

    const event = SOCKET_EVENTS.chatMessage(tradeId)
    const handler = (...args: unknown[]) => {
      const payload = args[0] as LivePayload
      setMessages((prev) =>
        appendMessage(prev, {
          id: payload.id ?? `live_${Date.now()}`,
          trade_id: payload.trade_id,
          sender_id: payload.sender_id,
          content: payload.content,
          event_type: payload.event_type ?? null,
          sent_at: payload.sent_at,
          created_at: payload.sent_at,
        })
      )
    }

    socket.on(event, handler as (...args: unknown[]) => void)
    return () => {
      socket.off(event, handler as (...args: unknown[]) => void)
      socket.emit('leave_trade', tradeId)
    }
  }, [socket, tradeId])

  return messages
}
