'use client'

// src/hooks/useSocket.ts
// Client-side hook for Socket.io connections.
// Requires: npm install socket.io-client
//
// Usage:
//   const socket = useSocket()
//   useEffect(() => {
//     socket?.emit('join_trade', tradeId)
//     socket?.on(`trade:${tradeId}:status`, handler)
//     return () => { socket?.off(`trade:${tradeId}:status`, handler) }
//   }, [socket, tradeId])

import { useEffect, useRef, useState } from 'react'

// Minimal socket interface — replaced with Socket from socket.io-client when installed
interface SocketLike {
  connected: boolean
  emit: (event: string, ...args: unknown[]) => void
  on: (event: string, listener: (...args: unknown[]) => void) => void
  off: (event: string, listener?: (...args: unknown[]) => void) => void
  disconnect: () => void
}

export function useSocket(): SocketLike | null {
  const [socket, setSocket] = useState<SocketLike | null>(null)
  const socketRef = useRef<SocketLike | null>(null)

  useEffect(() => {
    let active = true

    // Dynamically import socket.io-client to avoid SSR issues.
    // Install the package first: npm install socket.io-client
    import('socket.io-client' as string as never)
      .then((mod) => {
        if (!active) return
        const { io } = mod as { io: (url: string, opts: object) => SocketLike }
        const s = io(window.location.origin, { path: '/api/socket' })
        socketRef.current = s
        setSocket(s)
      })
      .catch(() => {
        // socket.io-client not installed — hook returns null gracefully
      })

    return () => {
      active = false
      socketRef.current?.disconnect()
      socketRef.current = null
    }
  }, [])

  return socket
}
