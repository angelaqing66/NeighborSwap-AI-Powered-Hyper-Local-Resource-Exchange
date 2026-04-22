'use client'

import { useActionState, useState } from 'react'
import { Star } from 'lucide-react'
import { submitReviewFormAction } from '@/actions/reviews'

interface TradeScoreFormProps {
  tradeId: string
}

const initialState = { error: null }

export default function TradeScoreForm({ tradeId }: TradeScoreFormProps) {
  const [score, setScore] = useState(50)
  const [submitted, setSubmitted] = useState(false)
  const [state, formAction, pending] = useActionState(submitReviewFormAction, initialState)

  const scoreColor =
    score >= 75 ? 'text-green-600' : score >= 50 ? 'text-amber-600' : 'text-red-500'

  if (submitted && !pending && state.error === null) {
    return (
      <div className="rounded-xl border border-green-200 bg-green-50 p-5">
        <div className="mb-1 flex items-center gap-2">
          <Star className="h-4 w-4 text-amber-500 fill-amber-500" aria-hidden />
          <span className="text-sm font-semibold text-green-800">Score submitted</span>
        </div>
        <p className="text-sm text-green-700">
          You gave this trade a score of <strong className="text-green-800">{score}/100</strong>.
          Thank you!
        </p>
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-center gap-2">
        <Star className="h-4 w-4 text-amber-500" aria-hidden />
        <h2 className="text-sm font-semibold text-gray-800">Score this trade</h2>
      </div>

      <form action={formAction} onSubmit={() => setSubmitted(true)}>
        <input type="hidden" name="trade_id" value={tradeId} />
        <input type="hidden" name="score" value={score} />

        {/* Slider */}
        <div className="mb-5">
          <div className="mb-1 flex items-baseline justify-between">
            <label className="text-xs font-medium text-gray-600" htmlFor="score-slider">
              Score
            </label>
            <span className={`text-2xl font-bold tabular-nums ${scoreColor}`}>
              {score}
              <span className="text-sm font-normal text-gray-400">/100</span>
            </span>
          </div>
          <input
            id="score-slider"
            type="range"
            min={1}
            max={100}
            step={1}
            value={score}
            onChange={(e) => setScore(Number(e.target.value))}
            className="h-2 w-full cursor-pointer appearance-none rounded-full bg-gray-200 accent-green-600"
          />
          <div className="mt-1 flex justify-between text-xs text-gray-400">
            <span>1 — Poor</span>
            <span>50 — OK</span>
            <span>100 — Excellent</span>
          </div>
        </div>

        {/* Optional comment */}
        <div className="mb-4">
          <label htmlFor="trade-comment" className="mb-1 block text-xs font-medium text-gray-600">
            Comment <span className="text-gray-400">(optional)</span>
          </label>
          <textarea
            id="trade-comment"
            name="comment"
            rows={3}
            maxLength={500}
            placeholder="How did the exchange go?"
            className="w-full resize-none rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-800 placeholder-gray-400 focus:border-green-500 focus:outline-none focus:ring-1 focus:ring-green-500"
          />
        </div>

        {state.error && <p className="mb-3 text-xs text-red-600">{state.error}</p>}

        <button
          type="submit"
          disabled={pending}
          className="w-full rounded-lg bg-green-600 py-2 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-50 transition-colors"
        >
          {pending ? 'Submitting…' : 'Submit score'}
        </button>
      </form>
    </div>
  )
}
