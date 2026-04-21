'use client'

// src/hooks/useChat.ts
// Subscribes to real-time chat messages for a trade room.
// Initial messages come from the server; socket events append new ones.

import { useEffect, useState } from 'react'
import { useSocket } from './useSocket'
import { SOCKET_EVENTS } from '@/lib/socket'
import type { ChatMessagePayload } from '@/lib/socket'
import type { Message } from '@/types/messages'

type LivePayload = ChatMessagePayload & { id?: string }

export function useChat(tradeId: string, initialMessages: Message[] = []): Message[] {
  const socket = useSocket()
  const [messages, setMessages] = useState<Message[]>(initialMessages)

  useEffect(() => {
    if (!socket) return

    socket.emit('join_trade', tradeId)

    const event = SOCKET_EVENTS.chatMessage(tradeId)
    const handler = (...args: unknown[]) => {
      const payload = args[0] as LivePayload
      setMessages((prev) => {
        // Skip duplicates — sender receives their own emit back from server
        if (payload.id && prev.some((m) => m.id === payload.id)) return prev
        return [
          ...prev,
          {
            id: payload.id ?? `live_${Date.now()}`,
            trade_id: payload.trade_id,
            sender_id: payload.sender_id,
            content: payload.content,
            event_type: payload.event_type ?? null,
            sent_at: payload.sent_at,
            created_at: payload.sent_at,
          },
        ]
      })
    }

    socket.on(event, handler as (...args: unknown[]) => void)
    return () => {
      socket.off(event, handler as (...args: unknown[]) => void)
      socket.emit('leave_trade', tradeId)
    }
  }, [socket, tradeId])

  return messages
}
