// src/types/reviews.ts
// Types mirroring the public.reviews table.

export interface Review {
  id: string
  trade_id: string
  reviewer_id: string
  reviewee_id: string
  score: number // 1–100
  comment: string | null
  sentiment_score: number | null // 0–100
  created_at: string // ISO-8601
}

export interface SubmitReviewInput {
  trade_id: string
  score: number // 1–100
  comment: string | null
}

export interface SubmitReviewResult {
  error: string | null
}
