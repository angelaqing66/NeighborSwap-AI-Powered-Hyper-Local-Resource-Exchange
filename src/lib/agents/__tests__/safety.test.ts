// src/lib/agents/__tests__/safety.test.ts
// TDD tests for the Safety Agent.
// Groq is mocked — no live API calls are made in this suite.

import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { SafetyAgentOutput } from '../safety'

// Mock the Groq client so tests never hit the network.
vi.mock('../groq-client', () => ({
  callGroq: vi.fn(),
  GroqError: class GroqError extends Error {
    constructor(message: string, public readonly cause?: unknown) {
      super(message)
      this.name = 'GroqError'
    }
  },
}))

// Import after mocking so the module picks up the mock.
import { runSafety, redactPii } from '../safety'
import { callGroq } from '../groq-client'

const mockCallGroq = vi.mocked(callGroq)

// Helper — build a minimal valid Groq JSON response.
function mockVerdict(overrides: Partial<SafetyAgentOutput> = {}): string {
  const defaults: SafetyAgentOutput = {
    verdict: 'allow',
    confidence: 0.99,
    reasoning: 'No issues found.',
    redacted_description: null,
  }
  return JSON.stringify({ ...defaults, ...overrides })
}

beforeEach(() => {
  vi.clearAllMocks()
})

// ---------------------------------------------------------------------------
// redactPii — unit tests for the pre-pass helper (no Groq involved)
// ---------------------------------------------------------------------------
describe('redactPii', () => {
  it.each([
    ['parentheses format',  '(408) 555-0199'],
    ['dash-separated',      '408-555-0199'  ],
    ['dot-separated',       '408.555.0199'  ],
    ['country code +1',     '+1 408-555-0199'],
    ['digit-only 10',       '4085550199'    ],
    ['digit-only 11',       '14085550199'   ],
  ])('redacts phone number: %s', (_label, phone) => {
    expect(redactPii(`Contact: ${phone}`)).not.toContain(phone)
    expect(redactPii(`Contact: ${phone}`)).toContain('[REDACTED]')
  })

  it('redacts an email address', () => {
    expect(redactPii('Email me at alice@example.com')).not.toContain('alice@example.com')
    expect(redactPii('Email me at alice@example.com')).toContain('[REDACTED]')
  })

  it('leaves clean text unchanged', () => {
    const clean = 'Nice bike, barely used, great condition.'
    expect(redactPii(clean)).toBe(clean)
  })
})

// ---------------------------------------------------------------------------
// runSafety — integration with mocked Groq
// ---------------------------------------------------------------------------
describe('PII redaction', () => {
  it('redacts a phone number to [REDACTED] in redacted_description', async () => {
    const phoneNumber = '(408) 555-0199'

    mockCallGroq.mockResolvedValueOnce(
      mockVerdict({
        verdict: 'review',
        confidence: 0.95,
        reasoning: 'Listing description contains a phone number.',
        redacted_description: `Call me at [REDACTED] to arrange pickup.`,
      }),
    )

    const result = await runSafety({
      trade_id: 'trade-001',
      initiator_id: 'user-abc',
      listing_title: 'Old bicycle for trade',
      listing_description: `Call me at ${phoneNumber} to arrange pickup.`,
      agreed_terms: null,
    })

    expect(result.redacted_description).not.toContain(phoneNumber)
    expect(result.redacted_description).toContain('[REDACTED]')
  })

  it('strips PII from the prompt before calling Groq', async () => {
    mockCallGroq.mockResolvedValueOnce(mockVerdict())

    await runSafety({
      trade_id: 'trade-002',
      initiator_id: 'user-abc',
      listing_title: 'Lawnmower',
      listing_description: 'Call 408-555-0199 or email bob@example.com',
      agreed_terms: null,
    })

    const promptSentToGroq = mockCallGroq.mock.calls[0][1] as string
    expect(promptSentToGroq).not.toContain('408-555-0199')
    expect(promptSentToGroq).not.toContain('bob@example.com')
  })
})
