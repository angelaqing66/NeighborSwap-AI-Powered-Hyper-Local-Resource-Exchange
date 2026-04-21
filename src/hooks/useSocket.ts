'use client'

// src/hooks/useSocket.ts
// Client-side hook for a shared Socket.io connection.
//
// Usage:
//   const socket = useSocket()
//   useEffect(() => {
//     if (!socket) return
//     socket.emit('join_trade', tradeId)
//     socket.on(`trade:${tradeId}:status`, handler)
//     return () => socket.off(`trade:${tradeId}:status`, handler)
//   }, [socket, tradeId])

import { useEffect, useRef, useState } from 'react'
import type { Socket } from 'socket.io-client'

export function useSocket(): Socket | null {
  const [socket, setSocket] = useState<Socket | null>(null)
  const socketRef = useRef<Socket | null>(null)

  useEffect(() => {
    let active = true

    import('socket.io-client')
      .then(({ io }) => {
        if (!active) return
        const s = io(window.location.origin, { path: '/api/socket' })
        socketRef.current = s
        setSocket(s)
      })
      .catch(() => {
        // socket.io-client unavailable — real-time features silently disabled
      })

    return () => {
      active = false
      socketRef.current?.disconnect()
      socketRef.current = null
    }
  }, [])

  return socket
}
