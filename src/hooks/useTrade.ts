'use client'

// src/hooks/useTrade.ts
// Subscribes to real-time trade status updates for a single trade.

import { useEffect, useState } from 'react'
import { useSocket } from './useSocket'
import { SOCKET_EVENTS } from '@/lib/socket'
import type { TradeStatusPayload } from '@/lib/socket'
import type { TradeStatus } from '@/types/trades'

export function useTrade(tradeId: string, initialStatus: TradeStatus): TradeStatus {
  const socket = useSocket()
  const [status, setStatus] = useState<TradeStatus>(initialStatus)

  useEffect(() => {
    setStatus(initialStatus)
  }, [initialStatus])

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
