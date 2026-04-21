// src/lib/socket/index.ts
// Socket.io event contract — constants and typed payloads.
//
// This file is safe to import inside Next.js App Router routes.
// It contains NO socket.io import; it is pure TypeScript.
//
// For the server-side Socket.io setup (requires npm install socket.io),
// see server.ts at the project root. That file must NOT be imported by any
// Next.js route handler or component — it runs outside the Next.js bundle.
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
  id?: string // DB-assigned message ID — present when emitted from Server Actions
  trade_id: string
  sender_id: string
  content: string
  event_type?: string // present only for system event messages
  sent_at: string // ISO-8601
}

export interface TradeStatusPayload {
  trade_id: string
  status: string
  updated_at: string // ISO-8601
}
