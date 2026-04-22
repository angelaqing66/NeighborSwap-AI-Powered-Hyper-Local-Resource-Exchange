// src/lib/agents/__tests__/sentiment.test.ts
// TDD tests for the Sentiment Agent.
// Groq is mocked — no live API calls are made in this suite.

import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { SentimentAgentOutput } from '../sentiment'

vi.mock('../groq-client', () => ({
  callGroq: vi.fn(),
  GroqError: class GroqError extends Error {
    constructor(
      message: string,
      public readonly cause?: unknown
    ) {
      super(message)
      this.name = 'GroqError'
    }
  },
}))

vi.mock('../safety', () => ({
  redactPii: (text: string) => text.replace(/\d{10,}/g, '[REDACTED]'),
}))

import { runSentiment } from '../sentiment'
import { callGroq } from '../groq-client'

const mockCallGroq = vi.mocked(callGroq)

function mockSentimentResponse(overrides: Partial<SentimentAgentOutput> = {}): string {
  const defaults: SentimentAgentOutput = {
    sentiment_score: 80,
    confidence: 0.9,
    reasoning: 'The 4-star rating and positive comment indicate a good experience.',
  }
  return JSON.stringify({ ...defaults, ...overrides })
}

const MINIMAL_INPUT = {
  review_id: 'review-001',
  star_rating: 4,
  comment: 'Great experience! The borrower was very careful with my item.',
}

const NO_COMMENT_INPUT = {
  review_id: 'review-002',
  star_rating: 3,
  comment: null,
}

beforeEach(() => {
  vi.clearAllMocks()
})

// ---------------------------------------------------------------------------
// A — Happy path: valid Groq responses are parsed correctly
// ---------------------------------------------------------------------------
describe('A — valid response parsing', () => {
  it('returns the sentiment_score from Groq response', async () => {
    mockCallGroq.mockResolvedValueOnce(mockSentimentResponse({ sentiment_score: 85 }))
    const result = await runSentiment(MINIMAL_INPUT)
    expect(result.sentiment_score).toBe(85)
  })

  it('returns the confidence from Groq response', async () => {
    mockCallGroq.mockResolvedValueOnce(mockSentimentResponse({ confidence: 0.95 }))
    const result = await runSentiment(MINIMAL_INPUT)
    expect(result.confidence).toBe(0.95)
  })

  it('returns the reasoning from Groq response', async () => {
    mockCallGroq.mockResolvedValueOnce(
      mockSentimentResponse({ reasoning: 'Positive comment reinforces the 4-star rating.' })
    )
    const result = await runSentiment(MINIMAL_INPUT)
    expect(result.reasoning).toBe('Positive comment reinforces the 4-star rating.')
  })

  it('rounds a fractional sentiment_score to the nearest integer', async () => {
    mockCallGroq.mockResolvedValueOnce(mockSentimentResponse({ sentiment_score: 74.6 }))
    const result = await runSentiment(MINIMAL_INPUT)
    expect(result.sentiment_score).toBe(75)
  })

  it('strips markdown fences from the Groq response', async () => {
    const withFences = '```json\n' + mockSentimentResponse() + '\n```'
    mockCallGroq.mockResolvedValueOnce(withFences)
    const result = await runSentiment(MINIMAL_INPUT)
    expect(result.sentiment_score).toBe(80)
  })

  it('handles null comment without error', async () => {
    mockCallGroq.mockResolvedValueOnce(mockSentimentResponse({ sentiment_score: 60 }))
    const result = await runSentiment(NO_COMMENT_INPUT)
    expect(result.sentiment_score).toBe(60)
  })

  it('handles 1-star rating correctly', async () => {
    mockCallGroq.mockResolvedValueOnce(mockSentimentResponse({ sentiment_score: 15 }))
    const result = await runSentiment({ ...MINIMAL_INPUT, star_rating: 1, comment: 'Terrible.' })
    expect(result.sentiment_score).toBe(15)
  })

  it('handles 5-star rating correctly', async () => {
    mockCallGroq.mockResolvedValueOnce(mockSentimentResponse({ sentiment_score: 100 }))
    const result = await runSentiment({ ...MINIMAL_INPUT, star_rating: 5, comment: 'Perfect!' })
    expect(result.sentiment_score).toBe(100)
  })
})

// ---------------------------------------------------------------------------
// B — Graceful degradation: invalid Groq responses return safe defaults
// ---------------------------------------------------------------------------
describe('B — graceful degradation on invalid response', () => {
  it('returns neutral score (50) when Groq returns invalid JSON', async () => {
    mockCallGroq.mockResolvedValueOnce('not json at all')
    const result = await runSentiment(MINIMAL_INPUT)
    expect(result.sentiment_score).toBe(50)
  })

  it('returns confidence 0 on parse failure', async () => {
    mockCallGroq.mockResolvedValueOnce('{}')
    const result = await runSentiment(MINIMAL_INPUT)
    expect(result.confidence).toBe(0)
  })

  it('returns parse error default when sentiment_score is missing', async () => {
    mockCallGroq.mockResolvedValueOnce(
      JSON.stringify({ confidence: 0.8, reasoning: 'Good review.' })
    )
    const result = await runSentiment(MINIMAL_INPUT)
    expect(result.sentiment_score).toBe(50)
  })

  it('returns parse error default when sentiment_score is out of range (> 100)', async () => {
    mockCallGroq.mockResolvedValueOnce(mockSentimentResponse({ sentiment_score: 150 }))
    const result = await runSentiment(MINIMAL_INPUT)
    expect(result.sentiment_score).toBe(50)
  })

  it('returns parse error default when sentiment_score is out of range (< 0)', async () => {
    mockCallGroq.mockResolvedValueOnce(mockSentimentResponse({ sentiment_score: -10 }))
    const result = await runSentiment(MINIMAL_INPUT)
    expect(result.sentiment_score).toBe(50)
  })

  it('returns parse error default when confidence is out of range', async () => {
    mockCallGroq.mockResolvedValueOnce(mockSentimentResponse({ confidence: 1.5 }))
    const result = await runSentiment(MINIMAL_INPUT)
    expect(result.sentiment_score).toBe(50)
  })

  it('returns parse error default when reasoning is empty', async () => {
    mockCallGroq.mockResolvedValueOnce(mockSentimentResponse({ reasoning: '' }))
    const result = await runSentiment(MINIMAL_INPUT)
    expect(result.sentiment_score).toBe(50)
  })

  it('returns parse error default when response is null JSON', async () => {
    mockCallGroq.mockResolvedValueOnce('null')
    const result = await runSentiment(MINIMAL_INPUT)
    expect(result.sentiment_score).toBe(50)
  })

  it('includes parse error explanation in reasoning', async () => {
    mockCallGroq.mockResolvedValueOnce('not json at all')
    const result = await runSentiment(MINIMAL_INPUT)
    expect(result.reasoning).toContain('could not parse')
  })
})

// ---------------------------------------------------------------------------
// C — Groq API failure: function degrades gracefully and never throws
// ---------------------------------------------------------------------------
describe('C — Groq API failure', () => {
  it('returns neutral score (50) when Groq throws', async () => {
    mockCallGroq.mockRejectedValueOnce(new Error('Groq timeout'))
    const result = await runSentiment(MINIMAL_INPUT)
    expect(result.sentiment_score).toBe(50)
    expect(result.confidence).toBe(0)
  })

  it('includes an explanation in reasoning when Groq is unavailable', async () => {
    mockCallGroq.mockRejectedValueOnce(new Error('Rate limit exceeded'))
    const result = await runSentiment(MINIMAL_INPUT)
    expect(result.reasoning).toContain('Sentiment agent unavailable')
  })

  it('resolves (does not throw) on Groq failure', async () => {
    mockCallGroq.mockRejectedValueOnce(new Error('Network error'))
    await expect(runSentiment(MINIMAL_INPUT)).resolves.toBeDefined()
  })

  it('handles GroqError specifically', async () => {
    const { GroqError } = await import('../groq-client')
    mockCallGroq.mockRejectedValueOnce(new GroqError('API key not set'))
    const result = await runSentiment(MINIMAL_INPUT)
    expect(result.sentiment_score).toBe(50)
    expect(result.confidence).toBe(0)
  })
})

// ---------------------------------------------------------------------------
// D — Result shape contract
// ---------------------------------------------------------------------------
describe('D — result shape', () => {
  it('always returns sentiment_score, confidence, and reasoning fields', async () => {
    mockCallGroq.mockResolvedValueOnce(mockSentimentResponse())
    const result = await runSentiment(MINIMAL_INPUT)
    expect(result).toHaveProperty('sentiment_score')
    expect(result).toHaveProperty('confidence')
    expect(result).toHaveProperty('reasoning')
  })

  it('sentiment_score is always a number between 0 and 100', async () => {
    mockCallGroq.mockResolvedValueOnce(mockSentimentResponse({ sentiment_score: 63 }))
    const result = await runSentiment(MINIMAL_INPUT)
    expect(result.sentiment_score).toBeGreaterThanOrEqual(0)
    expect(result.sentiment_score).toBeLessThanOrEqual(100)
  })

  it('review_id is never forwarded in the Groq call (audit correlation only)', async () => {
    mockCallGroq.mockResolvedValueOnce(mockSentimentResponse())
    await runSentiment({ ...MINIMAL_INPUT, review_id: 'sensitive-review-id-999' })
    const userPromptArg = mockCallGroq.mock.calls[0][1] as string
    expect(userPromptArg).not.toContain('sensitive-review-id-999')
  })
})

// ---------------------------------------------------------------------------
// LLM-as-judge evaluation
// ---------------------------------------------------------------------------

/**
 * Deterministic judge for sentiment output quality.
 * Criteria (1 point each, max 6):
 *   1. reasoning is a non-empty string
 *   2. reasoning is at least 20 characters
 *   3. reasoning references rating or comment (star, rating, comment, review, score)
 *   4. reasoning is consistent with score (high score → positive language; low score → concern)
 *   5. reasoning does not contain raw PII (no 7+ consecutive digits)
 *   6. reasoning is concise (≤ 300 characters)
 */
function scoreSentimentReasoning(reasoning: string, sentimentScore: number): number {
  let points = 0

  if (typeof reasoning === 'string' && reasoning.trim().length > 0) points += 1

  if (reasoning.trim().length >= 20) points += 1

  const qualityKeywords = /rating|star|comment|review|score|sentiment|positive|negative|tone/i
  if (qualityKeywords.test(reasoning)) points += 1

  if (
    sentimentScore >= 70 &&
    /positive|good|great|excellent|clear|trustworthy|well/i.test(reasoning)
  )
    points += 1
  if (sentimentScore < 40 && /negative|poor|concerning|bad|vague|sparse/i.test(reasoning))
    points += 1
  if (sentimentScore >= 40 && sentimentScore < 70) points += 1

  if (!/\d{7,}/.test(reasoning)) points += 1

  if (reasoning.length <= 300) points += 1

  return Math.min(points, 6)
}

describe('LLM-as-judge evaluation', () => {
  it('E-01: high sentiment score reasoning scores ≥ 4/6 on judge criteria', async () => {
    mockCallGroq.mockResolvedValueOnce(
      JSON.stringify({
        sentiment_score: 90,
        confidence: 0.92,
        reasoning:
          'The 5-star rating and highly positive comment indicate an excellent exchange. The borrower was described as responsible and careful.',
      })
    )
    const result = await runSentiment({ ...MINIMAL_INPUT, star_rating: 5 })
    expect(result.sentiment_score).toBe(90)
    expect(
      scoreSentimentReasoning(result.reasoning, result.sentiment_score)
    ).toBeGreaterThanOrEqual(4)
  })

  it('E-02: low sentiment score reasoning scores ≥ 4/6 on judge criteria', async () => {
    mockCallGroq.mockResolvedValueOnce(
      JSON.stringify({
        sentiment_score: 20,
        confidence: 0.85,
        reasoning:
          'The 1-star rating combined with a negative comment about poor handling indicates a very bad experience.',
      })
    )
    const result = await runSentiment({
      review_id: 'review-low',
      star_rating: 1,
      comment: 'Terrible — the borrower returned the item damaged.',
    })
    expect(result.sentiment_score).toBe(20)
    expect(
      scoreSentimentReasoning(result.reasoning, result.sentiment_score)
    ).toBeGreaterThanOrEqual(4)
  })

  it('E-03: reasoning does not contain raw PII', async () => {
    mockCallGroq.mockResolvedValueOnce(
      JSON.stringify({
        sentiment_score: 75,
        confidence: 0.88,
        reasoning:
          'Positive star rating with a supportive comment suggests a trustworthy borrower.',
      })
    )
    const result = await runSentiment(MINIMAL_INPUT)
    expect(/\d{7,}/.test(result.reasoning)).toBe(false)
  })
})
