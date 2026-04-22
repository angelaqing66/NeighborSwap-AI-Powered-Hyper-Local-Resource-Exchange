// src/app/(main)/chat/[tradeId]/page.tsx
// Chat window for a single trade. Server-renders initial messages, then
// hands off to ChatWindow for real-time delivery via Socket.io.

import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import ChatWindow from '@/components/chat/ChatWindow'
import TradeStatusPanel from '@/components/chat/TradeStatusPanel'
import { ReviewForm } from '@/components/trades/ReviewForm'
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
    .select('id, status, initiator_id, counterparty_id, item_id')
    .eq('id', tradeId)
    .single()

  if (!trade) notFound()

  const t = trade as Pick<Trade, 'id' | 'status' | 'initiator_id' | 'counterparty_id' | 'item_id'>
  if (t.initiator_id !== user.id && t.counterparty_id !== user.id) {
    redirect('/chat')
  }

  // Determine if current user is the counterparty (lender) for review eligibility
  const isCounterparty = t.counterparty_id === user.id

  // Fetch item title, counterparty profile, and initial messages in parallel
  const otherId = t.initiator_id === user.id ? t.counterparty_id : t.initiator_id

  let itemTitle: string | null = null
  let otherName: string | null = null
  let initialMessages: Message[] = []

  try {
    const [{ data: itemData }, { data: otherUserData }, { data: messages, error: msgFetchErr }] =
      await Promise.all([
        supabase.from('items').select('title').eq('id', t.item_id).single(),
        supabase.from('users').select('full_name').eq('id', otherId).single(),
        supabase
          .from('messages')
          .select('id, trade_id, sender_id, content, event_type, sent_at, created_at')
          .eq('trade_id', tradeId)
          .order('sent_at', { ascending: true })
          .limit(100),
      ])

    itemTitle = (itemData as { title: string } | null)?.title ?? null
    otherName = (otherUserData as { full_name: string | null } | null)?.full_name ?? null
    if (msgFetchErr) {
      console.error('[TradeChatPage] messages fetch error', msgFetchErr)
    }
    initialMessages = (messages ?? []) as Message[]
  } catch (err) {
    console.error('[TradeChatPage] parallel fetch threw', err)
    // Render page with empty data rather than crashing
  }

  // Check if the counterparty already reviewed this trade (only when eligible)
  let hasExistingReview = false
  if (isCounterparty && t.status === 'completed') {
    try {
      const { data: existingReview } = await supabase
        .from('reviews')
        .select('id')
        .eq('trade_id', tradeId)
        .eq('reviewer_id', user.id)
        .maybeSingle()
      hasExistingReview = existingReview !== null
    } catch {
      // If the check fails, default to not showing the form (safe fallback)
      hasExistingReview = true
    }
  }

  // Show review form when: trade is completed, current user is counterparty, no review yet
  const showReviewForm = t.status === 'completed' && isCounterparty && !hasExistingReview

  return (
    <div className="flex h-full flex-col">
      {/* Trade header */}
      <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-gray-800">
            {itemTitle ?? `Trade #${t.id.slice(0, 8).toUpperCase()}`}
          </p>
          <p className="text-xs text-gray-400">
            {otherName ? `with ${otherName}` : `#${t.id.slice(0, 8).toUpperCase()}`}
          </p>
        </div>
      </div>

      {/* Live status machine strip */}
      <TradeStatusPanel
        tradeId={tradeId}
        initialStatus={t.status}
        currentUserId={user.id}
        initiatorId={t.initiator_id}
        counterpartyId={t.counterparty_id}
      />

      {/* Review form — shown to the lender (counterparty) after trade completes */}
      {showReviewForm && (
        <div className="border-b border-gray-100 px-4 py-3">
          <ReviewForm tradeId={tradeId} />
        </div>
      )}

      {/* Real-time chat */}
      <ChatWindow
        tradeId={tradeId}
        currentUserId={user.id}
        initialMessages={initialMessages}
        initialStatus={t.status}
      />
    </div>
  )
}
