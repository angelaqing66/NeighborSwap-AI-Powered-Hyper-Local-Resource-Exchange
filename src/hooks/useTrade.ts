'use client'

// src/hooks/useTrade.ts
// Subscribes to real-time trade status updates for a single trade.
//
// Primary path: Supabase Realtime (postgres_changes) — works on all
// deployments including Vercel, no custom server required.
//
// Secondary path: Socket.io — active when the custom server.ts is running
// locally and emits the event after each DB write.

import { useEffect, useState } from 'react'
import { useSocket } from './useSocket'
import { createClient } from '@/lib/supabase/client'
import { SOCKET_EVENTS } from '@/lib/socket'
import type { TradeStatusPayload } from '@/lib/socket'
import type { TradeStatus } from '@/types/trades'

export function useTrade(tradeId: string, initialStatus: TradeStatus): TradeStatus {
  const socket = useSocket()
  const [status, setStatus] = useState<TradeStatus>(initialStatus)

  useEffect(() => {
    setStatus(initialStatus)
  }, [initialStatus])

  // ── Supabase Realtime (primary) ──────────────────────────────────────────
  // Subscribes to postgres_changes on the trades row.  Fires on every UPDATE
  // regardless of which server process caused it.
  useEffect(() => {
    const supabase = createClient()
    const channel = supabase
      .channel(`trade-status-${tradeId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'trades',
          filter: `id=eq.${tradeId}`,
        },
        (payload) => {
          const newStatus = (payload.new as { status: string }).status as TradeStatus
          setStatus(newStatus)
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [tradeId])

  // ── Socket.io (secondary) ────────────────────────────────────────────────
  // Only fires when the custom server.ts is running locally.
  useEffect(() => {
    if (!socket) return

    socket.emit('join_trade', tradeId)

    const event = SOCKET_EVENTS.tradeStatus(tradeId)
    const handler = (...args: unknown[]) => {
      const payload = args[0] as TradeStatusPayload
      setStatus(payload.status as TradeStatus)
    }

    socket.on(event, handler as (...args: unknown[]) => void)
    return () => {
      socket.off(event, handler as (...args: unknown[]) => void)
    }
  }, [socket, tradeId])

  return status
}
