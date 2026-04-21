// src/lib/socket/index.ts
// Socket.io event contract and server setup.
//
// Usage: attach createSocketServer(httpServer) in your custom server (server.ts).
// Requires: npm install socket.io
//
// Event namespacing pattern:
//   listing:<id>:update   — emitted when a listing is created, updated, or removed
//   chat:<roomId>:message — emitted when a chat message is sent in a trade room
//   trade:<id>:status     — emitted when a trade status transitions

// ---------------------------------------------------------------------------
// Event name helpers — use these instead of raw strings to avoid typos
// ---------------------------------------------------------------------------
export const SOCKET_EVENTS = {
  listingUpdate: (id: string) => `listing:${id}:update` as const,
  chatMessage: (roomId: string) => `chat:${roomId}:message` as const,
  tradeStatus: (id: string) => `trade:${id}:status` as const,
} as const

// ---------------------------------------------------------------------------
// Typed payloads for each event
// ---------------------------------------------------------------------------
export interface ListingUpdatePayload {
  listing_id: string
  action: 'created' | 'updated' | 'removed'
  updated_at: string // ISO-8601
}

export interface ChatMessagePayload {
  trade_id: string
  sender_id: string
  content: string
  sent_at: string // ISO-8601
}

export interface TradeStatusPayload {
  trade_id: string
  status: string
  updated_at: string // ISO-8601
}

// ---------------------------------------------------------------------------
// Server setup
//
// Call this from your custom Next.js server (server.ts) after creating the
// HTTP server. Pass the returned io instance to any route handler that needs
// to emit events.
//
// Example (server.ts):
//
//   import { createServer } from 'http'
//   import next from 'next'
//   import { createSocketServer } from './src/lib/socket'
//
//   const app = next({ dev: process.env.NODE_ENV !== 'production' })
//   const handle = app.getRequestHandler()
//
//   app.prepare().then(() => {
//     const httpServer = createServer(handle)
//     createSocketServer(httpServer)
//     httpServer.listen(3000)
//   })
// ---------------------------------------------------------------------------

// Socket.io import is deferred to runtime to avoid build errors when the
// package is not yet installed. Install with: npm install socket.io
export async function createSocketServer(httpServer: unknown): Promise<unknown> {
  const { Server } = (await import('socket.io' as string as never).catch(() => {
    throw new Error('[socket] socket.io is not installed. Run: npm install socket.io')
  })) as { Server: new (server: unknown, opts: unknown) => unknown }

  const io = new Server(httpServer, {
    path: '/api/socket',
    cors: {
      origin: process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000',
      methods: ['GET', 'POST'],
    },
  })

  // Type cast for event registration — replace with proper types once socket.io is installed
  const ioAny = io as { on: (event: string, cb: (socket: unknown) => void) => void }

  ioAny.on('connection', (socket) => {
    const s = socket as {
      id: string
      join: (room: string) => void
      on: (event: string, cb: (...args: unknown[]) => void) => void
    }

    // Join a trade room for scoped chat and status events
    s.on('join_trade', (...args: unknown[]) => {
      s.join(`trade:${String(args[0])}`)
    })

    // Join a listing room for real-time listing updates
    s.on('join_listing', (...args: unknown[]) => {
      s.join(`listing:${String(args[0])}`)
    })
  })

  return io
}
