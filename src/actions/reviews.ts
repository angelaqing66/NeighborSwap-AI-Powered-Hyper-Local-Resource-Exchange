'use server'

// src/actions/reviews.ts
// Server Action for submitting a trade review.

import { createClient } from '@/lib/supabase/server'
import { runSentiment } from '@/lib/agents/sentiment'

export interface SubmitReviewResult {
  error: string | null
}

export async function submitReviewAction(
  tradeId: string,
  score: number,
  comment: string | null
): Promise<SubmitReviewResult> {
  const supabase = await createClient()

  // 1. Auth check
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'You must be signed in to leave a review.' }

  // 2. Validate inputs
  if (!tradeId) return { error: 'Trade ID is required.' }
  if (!Number.isInteger(score) || score < 1 || score > 5) {
    return { error: 'Score must be an integer between 1 and 5.' }
  }

  // 3. Fetch the trade and verify eligibility
  const { data: trade } = await supabase
    .from('trades')
    .select('id, status, initiator_id, counterparty_id')
    .eq('id', tradeId)
    .single()

  if (!trade) return { error: 'Trade not found.' }

  const t = trade as {
    id: string
    status: string
    initiator_id: string
    counterparty_id: string
  }

  // Only counterparty (lender) can review after completion
  if (t.status !== 'completed') {
    return { error: 'Reviews can only be submitted for completed trades.' }
  }

  if (t.counterparty_id !== user.id) {
    return { error: 'Only the lender can leave a review for this trade.' }
  }

  // 4. Check for duplicate review
  const { data: existing } = await supabase
    .from('reviews')
    .select('id')
    .eq('trade_id', tradeId)
    .eq('reviewer_id', user.id)
    .maybeSingle()

  if (existing) {
    return { error: 'You have already submitted a review for this trade.' }
  }

  // 5. Run sentiment agent on the comment (if provided)
  let sentimentScore: number | null = null

  if (comment !== null && comment.trim() !== '') {
    const sentimentResult = await runSentiment({
      review_id: 'pending',
      star_rating: score,
      comment,
    })
    sentimentScore = sentimentResult.sentiment_score
  }

  // 6. Insert the review
  const reviewee_id = t.initiator_id

  const { error: insertError } = await supabase.from('reviews').insert({
    trade_id: tradeId,
    reviewer_id: user.id,
    reviewee_id,
    score,
    comment: comment?.trim() || null,
    sentiment_score: sentimentScore,
  })

  if (insertError) {
    // 23505 = unique_violation — duplicate review race condition
    if (insertError.code === '23505') {
      return { error: 'You have already submitted a review for this trade.' }
    }
    return { error: 'Failed to submit review. Please try again.' }
  }

  // 7. Recalculate reviewee's trust_score
  await supabase.rpc('recalculate_trust_score', { p_user_id: reviewee_id })

  return { error: null }
}
