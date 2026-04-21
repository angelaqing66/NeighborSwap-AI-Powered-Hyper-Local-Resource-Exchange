// src/app/api/socket/route.ts
// Socket.io health check endpoint.
// WebSocket upgrades are handled by the custom server (server.ts), not this route.
// This route exists for health checks and to document the event contract.

import { NextResponse } from 'next/server'
import { SOCKET_EVENTS } from '@/lib/socket'

export async function GET() {
  return NextResponse.json({
    status: 'ok',
    note: 'WebSocket upgrades are handled by the custom server. Connect via socket.io-client at /api/socket.',
    events: {
      listing: SOCKET_EVENTS.listingUpdate(':id'),
      chat: SOCKET_EVENTS.chatMessage(':roomId'),
      trade: SOCKET_EVENTS.tradeStatus(':id'),
    },
  })
}
