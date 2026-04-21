'use client'

import { useChat } from '@/hooks/useChat'
import { useTrade } from '@/hooks/useTrade'
import MessageList from './MessageList'
import MessageForm from './MessageForm'
import type { Message } from '@/types/messages'
import type { TradeStatus } from '@/types/trades'

interface ChatWindowProps {
  tradeId: string
  currentUserId: string
  initialMessages: Message[]
  initialStatus: TradeStatus
}

export default function ChatWindow({
  tradeId,
  currentUserId,
  initialMessages,
  initialStatus,
}: ChatWindowProps) {
  const messages = useChat(tradeId, initialMessages)
  const status = useTrade(tradeId, initialStatus)

  return (
    <div className="flex h-full flex-col">
      <MessageList messages={messages} currentUserId={currentUserId} />
      <MessageForm tradeId={tradeId} tradeStatus={status} />
    </div>
  )
}
