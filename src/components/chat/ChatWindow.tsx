'use client'

import { useChat } from '@/hooks/useChat'
import MessageList from './MessageList'
import MessageForm from './MessageForm'
import type { Message } from '@/types/messages'

interface ChatWindowProps {
  tradeId: string
  currentUserId: string
  initialMessages: Message[]
}

export default function ChatWindow({ tradeId, currentUserId, initialMessages }: ChatWindowProps) {
  const messages = useChat(tradeId, initialMessages)

  return (
    <div className="flex h-full flex-col">
      <MessageList messages={messages} currentUserId={currentUserId} />
      <MessageForm tradeId={tradeId} />
    </div>
  )
}
