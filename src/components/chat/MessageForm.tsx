'use client'

import { useState, useTransition } from 'react'
import { Send } from 'lucide-react'
import { sendMessageAction } from '@/actions/messages'
import { TERMINAL_STATUSES } from '@/types/trades'
import type { TradeStatus } from '@/types/trades'

interface MessageFormProps {
  tradeId: string
  tradeStatus: TradeStatus
}

export default function MessageForm({ tradeId, tradeStatus }: MessageFormProps) {
  const [content, setContent] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [safetyWarning, setSafetyWarning] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function submitMessage(text: string) {
    setError(null)
    setSafetyWarning(null)
    setContent('')
    startTransition(async () => {
      try {
        const result = await sendMessageAction(tradeId, text)
        if (result.error) {
          setError(result.error)
          setContent(text) // restore on failure
        } else if (result.safety_flags?.was_redacted) {
          setSafetyWarning(
            'Some personal information was automatically removed from your message to protect your privacy.'
          )
        } else if (result.safety_flags?.has_phishing_link) {
          setSafetyWarning('A suspicious link was detected in your message. Please be cautious.')
        }
      } catch (err) {
        // In Next.js 16 + React 19, async transitions throw (not return) on
        // network errors or stale deployment mismatches.  Catch here so the
        // error never reaches the route-level error boundary and crashes the
        // whole chat UI.  A stale action ID resolves after a page refresh.
        setContent(text) // restore so the user can retry
        const msg = err instanceof Error ? err.message : ''
        if (
          msg.toLowerCase().includes('server action') ||
          msg.toLowerCase().includes('not found')
        ) {
          setError('Page was updated — please refresh and try again.')
        } else {
          setError('Failed to send message. Please try again.')
        }
      }
    })
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const text = content.trim()
    if (!text || isPending) return
    submitMessage(text)
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      const text = content.trim()
      if (!text || isPending) return
      submitMessage(text)
    }
  }

  if (tradeStatus === 'pending_offer') {
    return (
      <div className="border-t border-gray-200 p-4">
        <p className="text-center text-sm text-gray-400">
          Waiting for the provider to accept your swap request.
        </p>
      </div>
    )
  }

  const isTerminal = (TERMINAL_STATUSES as readonly string[]).includes(tradeStatus)
  if (isTerminal) {
    return (
      <div className="border-t border-gray-200 p-4">
        <p className="text-center text-sm text-gray-400">This conversation is closed.</p>
      </div>
    )
  }

  return (
    <div className="border-t border-gray-200 p-4">
      {error && <p className="mb-2 text-xs text-red-600">{error}</p>}
      {safetyWarning && <p className="mb-2 text-xs text-amber-600">{safetyWarning}</p>}
      <form onSubmit={handleSubmit} className="flex items-end gap-2">
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Type a message… (Enter to send, Shift+Enter for new line)"
          disabled={isPending}
          rows={1}
          className="flex-1 resize-none rounded-xl border border-gray-300 px-3 py-2 text-sm focus:border-green-500 focus:outline-none focus:ring-1 focus:ring-green-500 disabled:opacity-50"
          style={{ maxHeight: '7.5rem', overflowY: 'auto' }}
        />
        <button
          type="submit"
          disabled={!content.trim() || isPending}
          aria-label="Send message"
          className="flex-shrink-0 rounded-xl bg-green-600 p-2.5 text-white transition-colors hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Send className="h-4 w-4" />
        </button>
      </form>
    </div>
  )
}
