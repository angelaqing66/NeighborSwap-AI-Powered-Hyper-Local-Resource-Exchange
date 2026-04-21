// server.ts — Custom Next.js server with Socket.io
//
// Replaces `next dev` / `next start` for environments that need real-time.
// Run with: npx tsx server.ts   (dev)  or  node dist/server.js  (prod)
//
// Requires: npm install socket.io
// Start:    npx tsx server.ts

import { createServer } from 'http'
import { parse } from 'url'
import next from 'next'
import { Server } from 'socket.io'
import { SOCKET_EVENTS } from './src/lib/socket'

const dev = process.env.NODE_ENV !== 'production'
const port = parseInt(process.env.PORT ?? '3000', 10)

const app = next({ dev })
const handle = app.getRequestHandler()

app.prepare().then(() => {
  const httpServer = createServer((req, res) => {
    const parsedUrl = parse(req.url ?? '/', true)
    handle(req, res, parsedUrl)
  })

  const io = new Server(httpServer, {
    path: '/api/socket',
    cors: {
      origin: process.env.NEXT_PUBLIC_APP_URL ?? `http://localhost:${port}`,
      methods: ['GET', 'POST'],
    },
  })

  io.on('connection', (socket) => {
    // Join a trade room to receive scoped chat and status events
    socket.on('join_trade', (tradeId: string) => {
      socket.join(`trade:${tradeId}`)
    })

    // Join a listing room to receive real-time listing updates
    socket.on('join_listing', (listingId: string) => {
      socket.join(`listing:${listingId}`)
    })
  })

  // Export io so Server Actions can emit events after DB writes
  // e.g. import { io } from '@/server' — only valid in custom server context
  ;(globalThis as Record<string, unknown>).__socketIo = io

  httpServer.listen(port, () => {
    console.log(`> Ready on http://localhost:${port} (${dev ? 'dev' : 'prod'})`)
    console.log(`> Socket.io listening on path /api/socket`)
    console.log(`> Events: ${SOCKET_EVENTS.listingUpdate(':id')}, ${SOCKET_EVENTS.chatMessage(':room')}, ${SOCKET_EVENTS.tradeStatus(':id')}`)
  })
})
