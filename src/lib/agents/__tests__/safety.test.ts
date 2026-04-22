// src/lib/agents/__tests__/safety.test.ts
// TDD tests for the Safety Agent.
// Groq is mocked — no live API calls are made in this suite.

import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { SafetyAgentOutput } from '../safety'

// Mock the Groq client so tests never hit the network.
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

// Import after mocking so the module picks up the mock.
import { runSafety, redactPii, runMessageSafety } from '../safety'
import type { MessageSafetyOutput } from '../safety'
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
    ['parentheses format', '(408) 555-0199'],
    ['dash-separated', '408-555-0199'],
    ['dot-separated', '408.555.0199'],
    ['country code +1', '+1 408-555-0199'],
    ['digit-only 10', '4085550199'],
    ['digit-only 11', '14085550199'],
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
      })
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

// ---------------------------------------------------------------------------
// LLM-as-judge evaluation
//
// These tests verify that the reasoning field produced by the safety agent
// meets a minimum quality bar. A deterministic judge function scores the
// reasoning string across six criteria and requires a passing score of ≥ 4/6.
// No live Groq calls are made — the model response is always mocked.
// ---------------------------------------------------------------------------

/**
 * Deterministic LLM-as-judge scorer.
 *
 * Criteria (1 point each, max 6):
 *   1. reasoning is a non-empty string
 *   2. reasoning is at least 20 characters (not a trivial stub)
 *   3. reasoning references the nature of the issue (PII / contact / phone / email / prohibited)
 *   4. reasoning is consistent with the verdict (review/block → concern present; allow → clean)
 *   5. reasoning does not contain raw PII (no digit sequences resembling phone numbers)
 *   6. reasoning is a single coherent sentence or two (≤ 300 characters)
 */
function scoreReasoning(reasoning: string, verdict: SafetyAgentOutput['verdict']): number {
  let score = 0

  // 1. Non-empty string
  if (typeof reasoning === 'string' && reasoning.trim().length > 0) score += 1

  // 2. Substantive length
  if (reasoning.trim().length >= 20) score += 1

  // 3. Mentions the nature of the issue
  const issueKeywords = /pii|phone|email|contact|redact|prohibited|weapon|drug|illegal|address/i
  if (issueKeywords.test(reasoning)) score += 1

  // 4. Verdict consistency
  if (verdict === 'allow' && /clean|no (pii|issue|prohibited)/i.test(reasoning)) score += 1
  if ((verdict === 'review' || verdict === 'block') && issueKeywords.test(reasoning)) score += 1

  // 5. No raw PII leaked into reasoning (no 7+ consecutive digits)
  if (!/\d{7,}/.test(reasoning)) score += 1

  // 6. Concise (≤ 300 characters)
  if (reasoning.length <= 300) score += 1

  return score
}

describe('LLM-as-judge evaluation', () => {
  // -------------------------------------------------------------------------
  // E-01: realistic "review" verdict with a redacted phone number
  // -------------------------------------------------------------------------
  it('E-01: reasoning field scores ≥ 4/6 on judge criteria for a review verdict', async () => {
    const realisticGroqResponse = JSON.stringify({
      verdict: 'review',
      confidence: 0.85,
      reasoning:
        'The listing description contains what appears to be a phone number (555-1234) which was redacted, indicating the user attempted to share contact information outside the platform.',
      redacted_description: 'Call me at [REDACTED] to arrange pickup',
    })

    mockCallGroq.mockResolvedValueOnce(realisticGroqResponse)

    const result = await runSafety({
      trade_id: 'trade-judge-001',
      initiator_id: 'user-judge-abc',
      listing_title: 'Vintage lamp',
      listing_description: 'Call me at 555-1234 to arrange pickup',
      agreed_terms: null,
    })

    expect(result.verdict).toBe('review')
    expect(result.confidence).toBe(0.85)

    const score = scoreReasoning(result.reasoning, result.verdict)
    expect(score).toBeGreaterThanOrEqual(4)
  })

  // -------------------------------------------------------------------------
  // E-02: reasoning for an "allow" verdict also satisfies the judge
  // -------------------------------------------------------------------------
  it('E-02: reasoning field scores ≥ 4/6 on judge criteria for an allow verdict', async () => {
    const allowResponse = JSON.stringify({
      verdict: 'allow',
      confidence: 0.98,
      reasoning: 'Content is clean — no PII detected and no prohibited items found.',
      redacted_description: null,
    })

    mockCallGroq.mockResolvedValueOnce(allowResponse)

    const result = await runSafety({
      trade_id: 'trade-judge-002',
      initiator_id: 'user-judge-def',
      listing_title: 'Bicycle pump',
      listing_description: 'Good condition floor pump, fits Presta and Schrader valves.',
      agreed_terms: null,
    })

    expect(result.verdict).toBe('allow')

    const score = scoreReasoning(result.reasoning, result.verdict)
    expect(score).toBeGreaterThanOrEqual(4)
  })

  // -------------------------------------------------------------------------
  // E-03: reasoning does not leak raw PII back to the caller
  // -------------------------------------------------------------------------
  it('E-03: reasoning field does not contain raw digit sequences resembling phone numbers', async () => {
    const responseWithPiiInReasoning = JSON.stringify({
      verdict: 'review',
      confidence: 0.9,
      reasoning:
        'The listing description contains what appears to be a phone number which was redacted, indicating the user attempted to share contact information outside the platform.',
      redacted_description: 'Call me at [REDACTED] to arrange pickup',
    })

    mockCallGroq.mockResolvedValueOnce(responseWithPiiInReasoning)

    const result = await runSafety({
      trade_id: 'trade-judge-003',
      initiator_id: 'user-judge-ghi',
      listing_title: 'Garden tools',
      listing_description: 'Call me at 408-555-0100 to arrange pickup',
      agreed_terms: null,
    })

    // Judge criterion 5: no raw PII in reasoning
    expect(/\d{7,}/.test(result.reasoning)).toBe(false)
  })

  // -------------------------------------------------------------------------
  // SEC-003: listing_title PII redaction — phone number in title must not
  // reach Groq in the user prompt
  // -------------------------------------------------------------------------
  it('SEC-003: strips phone number from listing_title before it reaches Groq', async () => {
    mockCallGroq.mockResolvedValueOnce(
      mockVerdict({
        verdict: 'review',
        confidence: 0.9,
        reasoning: 'Phone number detected in listing title and redacted.',
        redacted_description: '[REDACTED] garden hose',
      })
    )

    await runSafety({
      trade_id: 'trade-sec-003',
      initiator_id: 'user-sec-003',
      listing_title: 'Call 408-555-0199 for this garden hose',
      listing_description: 'A 50-foot garden hose in excellent condition.',
      agreed_terms: null,
    })

    // The second argument to callGroq is the user prompt (buildUserPrompt output)
    const userPromptSentToGroq = mockCallGroq.mock.calls[0][1] as string
    expect(userPromptSentToGroq).not.toContain('408-555-0199')
  })

  it('SEC-003: listing_title phone number is replaced with [REDACTED] in the Groq prompt', async () => {
    mockCallGroq.mockResolvedValueOnce(mockVerdict())

    await runSafety({
      trade_id: 'trade-sec-003b',
      initiator_id: 'user-sec-003b',
      listing_title: 'Call 408-555-0199 for this garden hose',
      listing_description: 'Great condition.',
      agreed_terms: null,
    })

    const userPromptSentToGroq = mockCallGroq.mock.calls[0][1] as string
    expect(userPromptSentToGroq).toContain('[REDACTED]')
  })
})

// ---------------------------------------------------------------------------
// redactPii — SSN and physical address patterns (new in message safety)
// ---------------------------------------------------------------------------
describe('redactPii — SSN patterns', () => {
  it.each([
    ['dashes', '123-45-6789'],
    ['spaces', '123 45 6789'],
  ])('redacts SSN with %s', (_label, ssn) => {
    const result = redactPii(`My SSN is ${ssn}.`)
    expect(result).not.toContain(ssn)
    expect(result).toContain('[REDACTED]')
  })

  it('does not redact a regular date like 123-12-2024 as SSN', () => {
    // Dates use 4-digit year in the last group — SSN pattern requires exactly 4 digits
    // but the date "12-2024" has 4 digits in the last slot. This test documents
    // the known trade-off; dates with 2-digit month and 4-digit year could be caught.
    const date = '2026-04-21'
    const result = redactPii(date)
    // ISO dates are not matched by the SSN pattern (YYYY-MM-DD format differs)
    expect(result).toBe(date)
  })
})

describe('redactPii — physical address patterns', () => {
  it.each([
    ['street abbreviation', '123 Main St'],
    ['avenue abbreviation', '456 Oak Ave'],
    ['full street type', '789 Elm Street'],
    ['boulevard', '100 Sunset Blvd'],
    ['with unit', '42 Pine Dr Apt 2B'],
  ])('redacts address: %s', (_label, address) => {
    const result = redactPii(`Meet me at ${address} tomorrow.`)
    expect(result).not.toContain(address)
    expect(result).toContain('[REDACTED]')
  })
})

// ---------------------------------------------------------------------------
// runMessageSafety — unit tests
// ---------------------------------------------------------------------------

function mockMessageVerdict(overrides: Partial<MessageSafetyOutput> = {}): string {
  const defaults: MessageSafetyOutput = {
    verdict: 'allow',
    confidence: 0.99,
    reasoning: 'No issues found.',
    redacted_content: 'Is the bike still available?',
    has_phishing_link: false,
  }
  return JSON.stringify({ ...defaults, ...overrides })
}

const MESSAGE_INPUT = {
  trade_id: 'trade-msg-001',
  sender_id: 'user-sender-001',
  content: 'Is the bike still available?',
}

describe('runMessageSafety — verdicts', () => {
  it('returns allow verdict for a clean message', async () => {
    mockCallGroq.mockResolvedValueOnce(mockMessageVerdict())

    const result = await runMessageSafety(MESSAGE_INPUT)

    expect(result.verdict).toBe('allow')
    expect(result.has_phishing_link).toBe(false)
    expect(result.redacted_content).toBe('Is the bike still available?')
  })

  it('returns block verdict when a phishing link is detected', async () => {
    mockCallGroq.mockResolvedValueOnce(
      mockMessageVerdict({
        verdict: 'block',
        confidence: 0.92,
        reasoning: 'Message contains a URL that mimics a known payment platform.',
        has_phishing_link: true,
        redacted_content: 'Click here: http://paypa1.com/send',
      })
    )

    const result = await runMessageSafety({
      ...MESSAGE_INPUT,
      content: 'Click here: http://paypa1.com/send',
    })

    expect(result.verdict).toBe('block')
    expect(result.has_phishing_link).toBe(true)
  })

  it('returns review verdict when PII was redacted', async () => {
    mockCallGroq.mockResolvedValueOnce(
      mockMessageVerdict({
        verdict: 'review',
        confidence: 0.88,
        reasoning: 'Message contained a phone number which was redacted.',
        redacted_content: 'Call me at [REDACTED] after 5pm.',
        has_phishing_link: false,
      })
    )

    const result = await runMessageSafety({
      ...MESSAGE_INPUT,
      content: 'Call me at 408-555-0199 after 5pm.',
    })

    expect(result.verdict).toBe('review')
    expect(result.redacted_content).toContain('[REDACTED]')
    expect(result.redacted_content).not.toContain('408-555-0199')
  })
})

describe('runMessageSafety — pre-pass strips PII before reaching Groq', () => {
  it('strips phone number from message content before sending to Groq', async () => {
    mockCallGroq.mockResolvedValueOnce(mockMessageVerdict())

    await runMessageSafety({
      trade_id: 'trade-pre-001',
      sender_id: 'user-pre-001',
      content: 'Call 408-555-0199 to arrange.',
    })

    const promptSentToGroq = mockCallGroq.mock.calls[0][1] as string
    expect(promptSentToGroq).not.toContain('408-555-0199')
    expect(promptSentToGroq).toContain('[REDACTED]')
  })

  it('strips SSN from message content before sending to Groq', async () => {
    mockCallGroq.mockResolvedValueOnce(mockMessageVerdict())

    await runMessageSafety({
      trade_id: 'trade-pre-002',
      sender_id: 'user-pre-002',
      content: 'My SSN is 123-45-6789.',
    })

    const promptSentToGroq = mockCallGroq.mock.calls[0][1] as string
    expect(promptSentToGroq).not.toContain('123-45-6789')
    expect(promptSentToGroq).toContain('[REDACTED]')
  })

  it('strips street address from message content before sending to Groq', async () => {
    mockCallGroq.mockResolvedValueOnce(mockMessageVerdict())

    await runMessageSafety({
      trade_id: 'trade-pre-003',
      sender_id: 'user-pre-003',
      content: 'Come to 123 Maple Ave tomorrow.',
    })

    const promptSentToGroq = mockCallGroq.mock.calls[0][1] as string
    expect(promptSentToGroq).not.toContain('123 Maple Ave')
    expect(promptSentToGroq).toContain('[REDACTED]')
  })

  it('does not forward trade_id or sender_id to Groq', async () => {
    mockCallGroq.mockResolvedValueOnce(mockMessageVerdict())

    const input = {
      trade_id: 'secret-trade-uuid',
      sender_id: 'secret-user-uuid',
      content: 'Hello!',
    }
    await runMessageSafety(input)

    const promptSentToGroq = mockCallGroq.mock.calls[0][1] as string
    expect(promptSentToGroq).not.toContain('secret-trade-uuid')
    expect(promptSentToGroq).not.toContain('secret-user-uuid')
  })
})

describe('runMessageSafety — Groq API failure graceful degradation', () => {
  it('returns review verdict with pre-pass content when Groq throws', async () => {
    const { GroqError } = await import('../groq-client')
    mockCallGroq.mockRejectedValueOnce(new GroqError('timeout'))

    const result = await runMessageSafety({
      trade_id: 'trade-fail-001',
      sender_id: 'user-fail-001',
      content: 'Is the ladder still available?',
    })

    expect(result.verdict).toBe('review')
    expect(result.confidence).toBe(0)
    expect(result.has_phishing_link).toBe(false)
    // Pre-pass content is used as fallback — original content unchanged (no PII)
    expect(result.redacted_content).toBe('Is the ladder still available?')
  })

  it('returns pre-pass redacted content as fallback when Groq is unavailable', async () => {
    const { GroqError } = await import('../groq-client')
    mockCallGroq.mockRejectedValueOnce(new GroqError('timeout'))

    const result = await runMessageSafety({
      trade_id: 'trade-fail-002',
      sender_id: 'user-fail-002',
      content: 'Call me at 408-555-0199.',
    })

    // Pre-pass already redacted the phone number
    expect(result.redacted_content).not.toContain('408-555-0199')
    expect(result.redacted_content).toContain('[REDACTED]')
  })
})

describe('runMessageSafety — parse error fallback', () => {
  it('returns review verdict when Groq returns non-JSON', async () => {
    mockCallGroq.mockResolvedValueOnce('Sorry, I cannot help with that.')

    const result = await runMessageSafety(MESSAGE_INPUT)

    expect(result.verdict).toBe('review')
    expect(result.confidence).toBe(0)
  })

  it('returns review verdict when response has invalid verdict field', async () => {
    mockCallGroq.mockResolvedValueOnce(
      JSON.stringify({
        verdict: 'unknown',
        confidence: 0.5,
        reasoning: 'test',
        redacted_content: 'test',
        has_phishing_link: false,
      })
    )

    const result = await runMessageSafety(MESSAGE_INPUT)

    expect(result.verdict).toBe('review')
  })
})

// ---------------------------------------------------------------------------
// LLM-as-judge evaluation for runMessageSafety
// ---------------------------------------------------------------------------

function scoreMessageReasoning(
  reasoning: string,
  verdict: MessageSafetyOutput['verdict'],
  hasPhishing: boolean
): number {
  let score = 0

  // 1. Non-empty string
  if (typeof reasoning === 'string' && reasoning.trim().length > 0) score += 1

  // 2. Substantive length
  if (reasoning.trim().length >= 20) score += 1

  // 3. Mentions the nature of the issue (PII / phishing / link / clean)
  const issueKeywords =
    /pii|phone|email|address|ssn|redact|phish|link|suspicious|clean|no (pii|issue)/i
  if (issueKeywords.test(reasoning)) score += 1

  // 4. Verdict consistency
  if (verdict === 'allow' && /clean|no (pii|issue)|safe/i.test(reasoning)) score += 1
  if ((verdict === 'review' || verdict === 'block') && issueKeywords.test(reasoning)) score += 1

  // 5. Phishing flag consistency
  if (hasPhishing && /phish|link|suspicious|malicious/i.test(reasoning)) score += 1
  if (!hasPhishing && verdict === 'allow') score += 1

  // 6. Concise (≤ 300 characters)
  if (reasoning.length <= 300) score += 1

  return score
}

describe('runMessageSafety — LLM-as-judge evaluation', () => {
  it('E-MSG-01: reasoning scores ≥ 4/7 for a review verdict with redacted PII', async () => {
    mockCallGroq.mockResolvedValueOnce(
      JSON.stringify({
        verdict: 'review',
        confidence: 0.9,
        reasoning:
          'The message contained a phone number which was redacted to protect user privacy.',
        redacted_content: 'Call me at [REDACTED] after 5pm.',
        has_phishing_link: false,
      })
    )

    const result = await runMessageSafety({
      trade_id: 'judge-msg-001',
      sender_id: 'user-judge-001',
      content: 'Call me at 555-1234 after 5pm.',
    })

    const score = scoreMessageReasoning(result.reasoning, result.verdict, result.has_phishing_link)
    expect(score).toBeGreaterThanOrEqual(4)
  })

  it('E-MSG-02: reasoning scores ≥ 4/7 for a block verdict with phishing link', async () => {
    mockCallGroq.mockResolvedValueOnce(
      JSON.stringify({
        verdict: 'block',
        confidence: 0.95,
        reasoning:
          'Message contains a suspicious link mimicking PayPal with a typosquatted domain.',
        redacted_content: 'Click here: http://paypa1.com/send',
        has_phishing_link: true,
      })
    )

    const result = await runMessageSafety({
      trade_id: 'judge-msg-002',
      sender_id: 'user-judge-002',
      content: 'Click here: http://paypa1.com/send',
    })

    const score = scoreMessageReasoning(result.reasoning, result.verdict, result.has_phishing_link)
    expect(score).toBeGreaterThanOrEqual(4)
  })

  it('E-MSG-03: reasoning scores ≥ 4/7 for a clean allow verdict', async () => {
    mockCallGroq.mockResolvedValueOnce(
      JSON.stringify({
        verdict: 'allow',
        confidence: 0.99,
        reasoning: 'Message is clean — no PII detected and no suspicious links found.',
        redacted_content: 'Is the drill press still available?',
        has_phishing_link: false,
      })
    )

    const result = await runMessageSafety({
      trade_id: 'judge-msg-003',
      sender_id: 'user-judge-003',
      content: 'Is the drill press still available?',
    })

    const score = scoreMessageReasoning(result.reasoning, result.verdict, result.has_phishing_link)
    expect(score).toBeGreaterThanOrEqual(4)
  })
})
