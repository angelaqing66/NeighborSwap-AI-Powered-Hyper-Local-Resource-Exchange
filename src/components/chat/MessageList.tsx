'use client'

import { useEffect, useRef } from 'react'
import { CheckCircle, Package, XCircle, AlertTriangle } from 'lucide-react'
import type { Message } from '@/types/messages'

interface MessageListProps {
  messages: Message[]
  currentUserId: string
}

const EVENT_CONFIG: Record<string, { label: string; Icon: React.ElementType; color: string }> = {
  'status:accepted': { label: 'Swap request accepted', Icon: CheckCircle, color: 'text-green-600' },
  'status:in_progress': { label: 'Pickup confirmed', Icon: Package, color: 'text-purple-600' },
  'status:completed': { label: 'Return confirmed', Icon: CheckCircle, color: 'text-blue-600' },
  'status:cancelled': { label: 'Trade cancelled', Icon: XCircle, color: 'text-gray-500' },
  'status:disputed': { label: 'Dispute raised', Icon: AlertTriangle, color: 'text-orange-600' },
}

// First-person labels when the current user performed the action.
const MY_EVENT_LABELS: Record<string, string> = {
  'status:accepted': 'You accepted the swap request',
  'status:in_progress': 'You confirmed pickup',
  'status:completed': 'You confirmed return',
  'status:cancelled': 'You cancelled the trade',
  'status:disputed': 'You raised a dispute',
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
        const time = new Date(msg.sent_at).toLocaleTimeString(undefined, {
          hour: '2-digit',
          minute: '2-digit',
        })

        // System event: render as a centered milestone card
        if (msg.event_type) {
          const cfg = EVENT_CONFIG[msg.event_type]
          const EventIcon = cfg?.Icon ?? CheckCircle
          const eventColor = cfg?.color ?? 'text-gray-500'
          const isMyEvent = msg.sender_id === currentUserId

          // When the stored content includes a reason (e.g. "Trade cancelled: reason"),
          // show it as-is for both parties. Otherwise, use first-person for the sender.
          const hasReason = cfg != null && msg.content !== cfg.label
          const displayLabel = hasReason
            ? msg.content
            : isMyEvent
              ? (MY_EVENT_LABELS[msg.event_type] ?? msg.content)
              : (cfg?.label ?? msg.content)

          return (
            <div key={msg.id} className="flex justify-center py-1">
              <div className="inline-flex items-center gap-1.5 rounded-full bg-gray-100 px-3 py-1 text-xs text-gray-500">
                <EventIcon className={`h-3 w-3 shrink-0 ${eventColor}`} aria-hidden />
                <span className="font-medium">{displayLabel}</span>
                <span aria-hidden>·</span>
                <time dateTime={msg.sent_at}>{time}</time>
              </div>
            </div>
          )
        }

        // Regular chat bubble
        const isMine = msg.sender_id === currentUserId
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
