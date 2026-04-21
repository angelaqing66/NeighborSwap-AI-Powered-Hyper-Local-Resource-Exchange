// src/app/(main)/chat/[tradeId]/page.tsx
// Chat window for a single trade. Server-renders initial messages, then
// hands off to ChatWindow for real-time delivery via Socket.io.

import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import ChatWindow from '@/components/chat/ChatWindow'
import type { Message } from '@/types/messages'
import type { Trade } from '@/types/trades'

interface PageProps {
  params: Promise<{ tradeId: string }>
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { tradeId } = await params
  return { title: `Trade #${tradeId.slice(0, 8).toUpperCase()} — Chat` }
}

export default async function TradeChatPage({ params }: PageProps) {
  const { tradeId } = await params
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Verify the trade exists and the current user is a party
  const { data: trade } = await supabase
    .from('trades')
    .select('id, status, initiator_id, counterparty_id')
    .eq('id', tradeId)
    .single()

  if (!trade) notFound()

  const t = trade as Pick<Trade, 'id' | 'status' | 'initiator_id' | 'counterparty_id'>
  if (t.initiator_id !== user.id && t.counterparty_id !== user.id) {
    redirect('/chat')
  }

  // Load the most recent 100 messages for initial render
  const { data: messages } = await supabase
    .from('messages')
    .select('*')
    .eq('trade_id', tradeId)
    .order('sent_at', { ascending: true })
    .limit(100)

  const initialMessages = (messages ?? []) as Message[]

  return (
    <div className="flex h-full flex-col">
      {/* Trade header */}
      <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
        <div>
          <p className="text-sm font-semibold text-gray-800">
            Trade #{t.id.slice(0, 8).toUpperCase()}
          </p>
          <p className="text-xs text-gray-400 capitalize">{t.status.replace(/_/g, ' ')}</p>
        </div>
      </div>

      {/* Real-time chat */}
      <ChatWindow tradeId={tradeId} currentUserId={user.id} initialMessages={initialMessages} />
    </div>
  )
}
