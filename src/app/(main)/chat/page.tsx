// src/app/(main)/chat/page.tsx
// Empty state shown when no trade is selected.

import type { Metadata } from 'next'
import { MessageSquare } from 'lucide-react'

export const metadata: Metadata = {
  title: 'Chat — NeighborSwap',
}

export default function ChatPage() {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-2 text-center">
      <MessageSquare className="h-10 w-10 text-gray-300" />
      <p className="text-sm font-medium text-gray-500">Select a trade to open the chat</p>
      <p className="text-xs text-gray-400">Messages are saved and delivered in real time</p>
    </div>
  )
}
