'use client'

import { useEffect, useRef } from 'react'
import type { Message } from '@/types/messages'

interface MessageListProps {
  messages: Message[]
  currentUserId: string
}

export default function MessageList({ messages, currentUserId }: MessageListProps) {
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages.length])

  if (messages.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center p-8 text-center">
        <p className="text-sm text-gray-400">No messages yet. Start the conversation!</p>
      </div>
    )
  }

  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-3">
      {messages.map((msg) => {
        const isMine = msg.sender_id === currentUserId
        const time = new Date(msg.sent_at).toLocaleTimeString(undefined, {
          hour: '2-digit',
          minute: '2-digit',
        })
        return (
          <div key={msg.id} className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}>
            <div
              className={`max-w-[72%] rounded-2xl px-4 py-2 ${
                isMine ? 'bg-green-600 text-white' : 'bg-gray-100 text-gray-900'
              }`}
            >
              <p className="text-sm break-words">{msg.content}</p>
              <p className={`mt-1 text-xs ${isMine ? 'text-green-200' : 'text-gray-400'}`}>
                {time}
              </p>
            </div>
          </div>
        )
      })}
      <div ref={bottomRef} />
    </div>
  )
}
