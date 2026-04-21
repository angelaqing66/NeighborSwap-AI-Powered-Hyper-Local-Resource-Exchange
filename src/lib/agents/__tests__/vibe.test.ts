// src/lib/agents/__tests__/vibe.test.ts
// TDD tests for the Vibe Agent.
// Groq is mocked — no live API calls are made in this suite.

import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { VibeAgentOutput } from '../vibe'

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

import { runVibe } from '../vibe'
import { callGroq } from '../groq-client'

const mockCallGroq = vi.mocked(callGroq)

function mockVibeResponse(overrides: Partial<VibeAgentOutput> = {}): string {
  const defaults: VibeAgentOutput = {
    score: 75,
    confidence: 0.88,
    reasoning: 'Clear description and fair terms indicate a trustworthy exchange.',
  }
  return JSON.stringify({ ...defaults, ...overrides })
}

const MINIMAL_INPUT = {
  trade_id: 'trade-vibe-001',
  listing_title: 'Lawnmower, self-propelled',
  listing_description: 'Honda mower, well-maintained, oil changed last season.',
  agreed_terms: 'Borrow for the weekend, return by Sunday evening.',
}

beforeEach(() => {
  vi.clearAllMocks()
})

// ---------------------------------------------------------------------------
// A — Happy path: valid Groq responses are parsed correctly
// ---------------------------------------------------------------------------
describe('A — valid response parsing', () => {
  it('returns the score from Groq response', async () => {
    mockCallGroq.mockResolvedValueOnce(mockVibeResponse({ score: 82 }))
    const result = await runVibe(MINIMAL_INPUT)
    expect(result.score).toBe(82)
  })

  it('returns the confidence from Groq response', async () => {
    mockCallGroq.mockResolvedValueOnce(mockVibeResponse({ confidence: 0.91 }))
    const result = await runVibe(MINIMAL_INPUT)
    expect(result.confidence).toBe(0.91)
  })

  it('returns the reasoning from Groq response', async () => {
    mockCallGroq.mockResolvedValueOnce(
      mockVibeResponse({ reasoning: 'Detailed listing with mutual terms.' })
    )
    const result = await runVibe(MINIMAL_INPUT)
    expect(result.reasoning).toBe('Detailed listing with mutual terms.')
  })

  it('rounds a fractional score to the nearest integer', async () => {
    mockCallGroq.mockResolvedValueOnce(mockVibeResponse({ score: 74.6 }))
    const result = await runVibe(MINIMAL_INPUT)
    expect(result.score).toBe(75)
  })

  it('strips markdown fences from the Groq response', async () => {
    const withFences = '```json\n' + mockVibeResponse() + '\n```'
    mockCallGroq.mockResolvedValueOnce(withFences)
    const result = await runVibe(MINIMAL_INPUT)
    expect(result.score).toBe(75)
  })
})

// ---------------------------------------------------------------------------
// B — Graceful degradation: invalid Groq responses return safe defaults
// ---------------------------------------------------------------------------
describe('B — graceful degradation on invalid response', () => {
  it('returns neutral score (50) when Groq returns invalid JSON', async () => {
    mockCallGroq.mockResolvedValueOnce('not json at all')
    const result = await runVibe(MINIMAL_INPUT)
    expect(result.score).toBe(50)
  })

  it('returns confidence 0 on parse failure', async () => {
    mockCallGroq.mockResolvedValueOnce('{}')
    const result = await runVibe(MINIMAL_INPUT)
    expect(result.confidence).toBe(0)
  })

  it('returns default when score is missing', async () => {
    mockCallGroq.mockResolvedValueOnce(
      JSON.stringify({ confidence: 0.8, reasoning: 'Good listing.' })
    )
    const result = await runVibe(MINIMAL_INPUT)
    expect(result.score).toBe(50)
  })

  it('returns default when score is out of range (> 100)', async () => {
    mockCallGroq.mockResolvedValueOnce(mockVibeResponse({ score: 150 }))
    const result = await runVibe(MINIMAL_INPUT)
    expect(result.score).toBe(50)
  })

  it('returns default when score is out of range (< 0)', async () => {
    mockCallGroq.mockResolvedValueOnce(mockVibeResponse({ score: -5 }))
    const result = await runVibe(MINIMAL_INPUT)
    expect(result.score).toBe(50)
  })

  it('returns default when confidence is out of range', async () => {
    mockCallGroq.mockResolvedValueOnce(mockVibeResponse({ confidence: 1.5 }))
    const result = await runVibe(MINIMAL_INPUT)
    expect(result.score).toBe(50)
  })

  it('returns default when reasoning is empty', async () => {
    mockCallGroq.mockResolvedValueOnce(mockVibeResponse({ reasoning: '' }))
    const result = await runVibe(MINIMAL_INPUT)
    expect(result.score).toBe(50)
  })
})

// ---------------------------------------------------------------------------
// C — Groq API failure: function degrades gracefully and never throws
// ---------------------------------------------------------------------------
describe('C — Groq API failure', () => {
  it('returns neutral score when Groq throws', async () => {
    mockCallGroq.mockRejectedValueOnce(new Error('Groq timeout'))
    const result = await runVibe(MINIMAL_INPUT)
    expect(result.score).toBe(50)
    expect(result.confidence).toBe(0)
  })

  it('includes an explanation in reasoning when Groq is unavailable', async () => {
    mockCallGroq.mockRejectedValueOnce(new Error('Rate limit exceeded'))
    const result = await runVibe(MINIMAL_INPUT)
    expect(result.reasoning).toContain('Vibe agent unavailable')
  })

  it('resolves (does not throw) on Groq failure', async () => {
    mockCallGroq.mockRejectedValueOnce(new Error('Network error'))
    await expect(runVibe(MINIMAL_INPUT)).resolves.toBeDefined()
  })
})

// ---------------------------------------------------------------------------
// D — Result shape contract
// ---------------------------------------------------------------------------
describe('D — result shape', () => {
  it('always returns score, confidence, and reasoning fields', async () => {
    mockCallGroq.mockResolvedValueOnce(mockVibeResponse())
    const result = await runVibe(MINIMAL_INPUT)
    expect(result).toHaveProperty('score')
    expect(result).toHaveProperty('confidence')
    expect(result).toHaveProperty('reasoning')
  })

  it('score is always a number between 0 and 100', async () => {
    mockCallGroq.mockResolvedValueOnce(mockVibeResponse({ score: 63 }))
    const result = await runVibe(MINIMAL_INPUT)
    expect(result.score).toBeGreaterThanOrEqual(0)
    expect(result.score).toBeLessThanOrEqual(100)
  })

  it('handles agreed_terms: null without error', async () => {
    mockCallGroq.mockResolvedValueOnce(mockVibeResponse())
    const result = await runVibe({ ...MINIMAL_INPUT, agreed_terms: null })
    expect(result.score).toBe(75)
  })
})

// ---------------------------------------------------------------------------
// LLM-as-judge evaluation
// ---------------------------------------------------------------------------

/**
 * Deterministic judge for vibe output quality.
 * Criteria (1 point each, max 6):
 *   1. reasoning is a non-empty string
 *   2. reasoning is at least 20 characters (not a trivial stub)
 *   3. reasoning references the nature of the score (listing quality, terms, trust, community, etc.)
 *   4. reasoning is consistent with score (high score → positive language; low score → concern)
 *   5. reasoning does not contain raw PII (no 7+ consecutive digits)
 *   6. reasoning is concise (≤ 300 characters)
 */
function scoreVibeReasoning(reasoning: string, score: number): number {
  let points = 0

  if (typeof reasoning === 'string' && reasoning.trim().length > 0) points += 1

  if (reasoning.trim().length >= 20) points += 1

  const qualityKeywords =
    /listing|description|terms|trust|community|clear|vague|fair|detail|condition|rating|score/i
  if (qualityKeywords.test(reasoning)) points += 1

  if (
    score >= 70 &&
    /clear|detail|fair|honest|good|excellent|trustworthy|positive/i.test(reasoning)
  )
    points += 1
  if (score < 40 && /vague|suspicious|one.sided|concerning|unclear|sparse/i.test(reasoning))
    points += 1
  if (score >= 40 && score < 70) points += 1

  if (!/\d{7,}/.test(reasoning)) points += 1

  if (reasoning.length <= 300) points += 1

  return Math.min(points, 6)
}

describe('LLM-as-judge evaluation', () => {
  it('E-01: high score reasoning scores ≥ 4/6 on judge criteria', async () => {
    mockCallGroq.mockResolvedValueOnce(
      JSON.stringify({
        score: 85,
        confidence: 0.9,
        reasoning:
          'The listing provides a detailed, honest description with clear condition notes. Trade terms are mutual and fair, reflecting strong community values.',
      })
    )
    const result = await runVibe(MINIMAL_INPUT)
    expect(result.score).toBe(85)
    expect(scoreVibeReasoning(result.reasoning, result.score)).toBeGreaterThanOrEqual(4)
  })

  it('E-02: low score reasoning scores ≥ 4/6 on judge criteria', async () => {
    mockCallGroq.mockResolvedValueOnce(
      JSON.stringify({
        score: 22,
        confidence: 0.75,
        reasoning:
          'The listing description is vague and the trade terms are one-sided, favoring only the lender. Concerning lack of detail raises trust concerns.',
      })
    )
    const result = await runVibe({
      ...MINIMAL_INPUT,
      listing_description: 'Stuff.',
      agreed_terms: 'You bring me something.',
    })
    expect(result.score).toBe(22)
    expect(scoreVibeReasoning(result.reasoning, result.score)).toBeGreaterThanOrEqual(4)
  })

  it('E-03: reasoning does not contain raw PII', async () => {
    mockCallGroq.mockResolvedValueOnce(
      JSON.stringify({
        score: 70,
        confidence: 0.82,
        reasoning: 'Clear listing description with fair trade terms and good community alignment.',
      })
    )
    const result = await runVibe(MINIMAL_INPUT)
    expect(/\d{7,}/.test(result.reasoning)).toBe(false)
  })
})
