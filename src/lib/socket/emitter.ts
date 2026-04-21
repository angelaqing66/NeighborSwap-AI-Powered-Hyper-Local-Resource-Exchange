// src/lib/socket/emitter.ts
// Server-side emit helper for Server Actions.
// Safe no-op when running without the custom server (e.g. plain `next dev`).

import type { Server } from 'socket.io'

export function emitToRoom(room: string, event: string, payload: unknown): void {
  const io = (globalThis as { __socketIo?: Server }).__socketIo
  ;(io as unknown as { to: (r: string) => { emit: (e: string, p: unknown) => void } } | undefined)
    ?.to(room)
    .emit(event, payload)
}
