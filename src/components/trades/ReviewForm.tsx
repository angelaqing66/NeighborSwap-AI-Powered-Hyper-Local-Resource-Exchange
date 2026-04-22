'use client'

// src/components/trades/ReviewForm.tsx
// Review form displayed after a trade is completed.
// The counterparty (lender) can rate the initiator (borrower) 1–5 stars
// and optionally leave a text comment.

import { useState, useTransition } from 'react'
import { Star, Loader2 } from 'lucide-react'
import { submitReviewAction } from '@/actions/reviews'

interface ReviewFormProps {
  tradeId: string
}

export function ReviewForm({ tradeId }: ReviewFormProps) {
  const [isPending, startTransition] = useTransition()
  const [selectedScore, setSelectedScore] = useState<number | null>(null)
  const [hoveredScore, setHoveredScore] = useState<number | null>(null)
  const [comment, setComment] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const displayScore = hoveredScore ?? selectedScore

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)

    if (!selectedScore) {
      setError('Please select a star rating before submitting.')
      return
    }

    startTransition(async () => {
      const result = await submitReviewAction(tradeId, selectedScore, comment.trim() || null)

      if (result.error) {
        setError(result.error)
      } else {
        setSubmitted(true)
      }
    })
  }

  if (submitted) {
    return (
      <div className="rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
        <p className="font-medium">Review submitted — thank you!</p>
        <p className="mt-0.5 text-xs text-green-600">
          Your rating has been counted toward this user&apos;s trust score.
        </p>
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
      <h3 className="mb-3 text-sm font-semibold text-gray-800">Leave a Review</h3>
      <form onSubmit={handleSubmit} noValidate>
        {/* Star rating */}
        <div className="mb-3">
          <p className="mb-1.5 text-xs font-medium text-gray-600">Rating</p>
          <div className="flex items-center gap-1" role="radiogroup" aria-label="Star rating">
            {[1, 2, 3, 4, 5].map((star) => (
              <button
                key={star}
                type="button"
                role="radio"
                aria-checked={selectedScore === star}
                aria-label={`${star} star${star !== 1 ? 's' : ''}`}
                disabled={isPending}
                onClick={() => setSelectedScore(star)}
                onMouseEnter={() => setHoveredScore(star)}
                onMouseLeave={() => setHoveredScore(null)}
                className="rounded p-0.5 transition-transform hover:scale-110 focus:outline-none focus-visible:ring-2 focus-visible:ring-yellow-400 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Star
                  className={`h-6 w-6 transition-colors ${
                    displayScore !== null && star <= displayScore
                      ? 'fill-yellow-400 text-yellow-400'
                      : 'fill-none text-gray-300'
                  }`}
                  aria-hidden
                />
              </button>
            ))}
            {selectedScore && (
              <span className="ml-1.5 text-xs text-gray-500">{selectedScore} / 5</span>
            )}
          </div>
        </div>

        {/* Comment */}
        <div className="mb-3">
          <label
            htmlFor="review-comment"
            className="mb-1.5 block text-xs font-medium text-gray-600"
          >
            Comment <span className="font-normal text-gray-400">(optional)</span>
          </label>
          <textarea
            id="review-comment"
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            disabled={isPending}
            rows={3}
            placeholder="How did the exchange go? Was the borrower responsible with your item?"
            className="w-full resize-none rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-700 placeholder-gray-400 focus:border-green-500 focus:outline-none focus:ring-1 focus:ring-green-500 disabled:opacity-50"
            maxLength={500}
          />
          <p className="mt-0.5 text-right text-xs text-gray-400">{comment.length}/500</p>
        </div>

        {/* Error */}
        {error && (
          <p className="mb-2 text-xs text-red-600" role="alert">
            {error}
          </p>
        )}

        {/* Submit */}
        <button
          type="submit"
          disabled={isPending || !selectedScore}
          className="inline-flex items-center gap-1.5 rounded-lg border border-green-300 bg-green-50 px-3 py-1.5 text-sm font-medium text-green-700 transition-colors hover:bg-green-100 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />}
          Submit Review
        </button>
      </form>
    </div>
  )
}
