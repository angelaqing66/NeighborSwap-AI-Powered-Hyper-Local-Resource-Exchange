// src/lib/agents/__tests__/logistics.test.ts
// TDD tests for the Logistics Agent.
// Groq is mocked — no live API calls are made in this suite.

import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { LogisticsAgentOutput } from '../logistics'

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

// Mock safety module to isolate redactPii dependency
vi.mock('../safety', () => ({
  redactPii: (text: string) => text.replace(/\d{10,}/g, '[REDACTED]'),
}))

import { runLogistics } from '../logistics'
import { callGroq } from '../groq-client'

const mockCallGroq = vi.mocked(callGroq)

function mockLogisticsResponse(overrides: Partial<LogisticsAgentOutput> = {}): string {
  const defaults: LogisticsAgentOutput = {
    method: 'pickup',
    scheduled_at: '2026-04-23T10:00:00Z',
    location: { lat: 42.3601, lng: -71.0589, label: "Lender's front porch" },
    notes: 'Please ring the doorbell.',
  }
  return JSON.stringify({ ...defaults, ...overrides })
}

const MINIMAL_INPUT = {
  trade_id: 'trade-logistics-001',
  listing_title: 'Garden hose, 50 ft',
  listing_description: 'Good condition garden hose. Pickup from my porch.',
  agreed_terms: 'Pickup Saturday morning.',
}

beforeEach(() => {
  vi.clearAllMocks()
})

// ---------------------------------------------------------------------------
// A — Happy path: valid Groq responses are parsed correctly
// ---------------------------------------------------------------------------
describe('A — valid response parsing', () => {
  it('returns the correct method from Groq response', async () => {
    mockCallGroq.mockResolvedValueOnce(mockLogisticsResponse({ method: 'pickup' }))
    const result = await runLogistics(MINIMAL_INPUT)
    expect(result.method).toBe('pickup')
  })

  it('returns the scheduled_at from Groq response', async () => {
    mockCallGroq.mockResolvedValueOnce(
      mockLogisticsResponse({ scheduled_at: '2026-04-25T10:00:00Z' })
    )
    const result = await runLogistics(MINIMAL_INPUT)
    expect(result.scheduled_at).toBe('2026-04-25T10:00:00Z')
  })

  it('returns location data for pickup method', async () => {
    mockCallGroq.mockResolvedValueOnce(
      mockLogisticsResponse({
        method: 'pickup',
        location: { lat: 42.36, lng: -71.06, label: "Lender's front porch" },
      })
    )
    const result = await runLogistics(MINIMAL_INPUT)
    expect(result.location).toEqual({ lat: 42.36, lng: -71.06, label: "Lender's front porch" })
  })

  it('returns no location for digital method', async () => {
    mockCallGroq.mockResolvedValueOnce(
      mockLogisticsResponse({ method: 'digital', location: undefined })
    )
    const result = await runLogistics(MINIMAL_INPUT)
    expect(result.location).toBeUndefined()
  })

  it('strips markdown fences from the Groq response', async () => {
    const withFences = '```json\n' + mockLogisticsResponse() + '\n```'
    mockCallGroq.mockResolvedValueOnce(withFences)
    const result = await runLogistics(MINIMAL_INPUT)
    expect(result.method).toBe('pickup')
  })

  it('includes notes when Groq provides them', async () => {
    mockCallGroq.mockResolvedValueOnce(mockLogisticsResponse({ notes: 'Call before arriving.' }))
    const result = await runLogistics(MINIMAL_INPUT)
    expect(result.notes).toBe('Call before arriving.')
  })
})

// ---------------------------------------------------------------------------
// B — Graceful degradation: invalid Groq responses return safe defaults
// ---------------------------------------------------------------------------
describe('B — graceful degradation on invalid response', () => {
  it('returns default output when Groq returns invalid JSON', async () => {
    mockCallGroq.mockResolvedValueOnce('not json at all')
    const result = await runLogistics(MINIMAL_INPUT)
    expect(result.method).toBe('pickup')
    expect(result.scheduled_at).toBeTruthy()
  })

  it('returns default output when method is missing', async () => {
    mockCallGroq.mockResolvedValueOnce(JSON.stringify({ scheduled_at: '2026-04-23T10:00:00Z' }))
    const result = await runLogistics(MINIMAL_INPUT)
    expect(result.method).toBe('pickup')
  })

  it('returns default output when method is an unknown value', async () => {
    mockCallGroq.mockResolvedValueOnce(
      JSON.stringify({ method: 'teleport', scheduled_at: '2026-04-23T10:00:00Z' })
    )
    const result = await runLogistics(MINIMAL_INPUT)
    expect(result.method).toBe('pickup')
  })

  it('returns default output when scheduled_at is missing', async () => {
    mockCallGroq.mockResolvedValueOnce(JSON.stringify({ method: 'pickup' }))
    const result = await runLogistics(MINIMAL_INPUT)
    expect(result.method).toBe('pickup')
    expect(result.scheduled_at).toBeTruthy()
  })

  it('returns a future scheduled_at even on parse failure', async () => {
    mockCallGroq.mockResolvedValueOnce('{}')
    const result = await runLogistics(MINIMAL_INPUT)
    const scheduled = new Date(result.scheduled_at)
    expect(scheduled.getTime()).toBeGreaterThan(Date.now())
  })
})

// ---------------------------------------------------------------------------
// C — Groq API failure: function degrades gracefully and never throws
// ---------------------------------------------------------------------------
describe('C — Groq API failure', () => {
  it('returns default output when Groq throws GroqError', async () => {
    mockCallGroq.mockRejectedValueOnce(new Error('Groq rate limit'))
    const result = await runLogistics(MINIMAL_INPUT)
    expect(result.method).toBe('pickup')
    expect(result.scheduled_at).toBeTruthy()
  })

  it('includes an explanation in notes when Groq is unavailable', async () => {
    mockCallGroq.mockRejectedValueOnce(new Error('Groq timeout'))
    const result = await runLogistics(MINIMAL_INPUT)
    expect(result.notes).toContain('Logistics agent unavailable')
  })

  it('resolves (does not throw) on Groq failure', async () => {
    mockCallGroq.mockRejectedValueOnce(new Error('Network error'))
    await expect(runLogistics(MINIMAL_INPUT)).resolves.toBeDefined()
  })
})

// ---------------------------------------------------------------------------
// D — Result shape contract
// ---------------------------------------------------------------------------
describe('D — result shape', () => {
  it('always includes method and scheduled_at fields', async () => {
    mockCallGroq.mockResolvedValueOnce(mockLogisticsResponse())
    const result = await runLogistics(MINIMAL_INPUT)
    expect(result).toHaveProperty('method')
    expect(result).toHaveProperty('scheduled_at')
  })

  it('handles agreed_terms: null without error', async () => {
    mockCallGroq.mockResolvedValueOnce(mockLogisticsResponse())
    const result = await runLogistics({ ...MINIMAL_INPUT, agreed_terms: null })
    expect(result.method).toBe('pickup')
  })
})

// ---------------------------------------------------------------------------
// LLM-as-judge evaluation
// ---------------------------------------------------------------------------

/**
 * Deterministic judge for logistics output quality.
 * Criteria (1 point each, max 5):
 *   1. method is one of the valid values
 *   2. scheduled_at is a non-empty string resembling an ISO datetime
 *   3. notes (if present) is a non-empty, non-trivial string (≥ 10 chars)
 *   4. location label (if present) does not contain raw PII (no 7+ digit runs)
 *   5. scheduled_at appears to be a future date (after 2026-01-01)
 */
function scoreLogisticsOutput(output: LogisticsAgentOutput): number {
  let score = 0

  if (output.method === 'pickup' || output.method === 'delivery' || output.method === 'digital')
    score += 1

  if (typeof output.scheduled_at === 'string' && output.scheduled_at.length >= 10) score += 1

  if (!output.notes || (typeof output.notes === 'string' && output.notes.length >= 10)) score += 1

  const labelPiiSafe = !output.location || !/\d{7,}/.test(output.location.label)
  if (labelPiiSafe) score += 1

  const futureThreshold = new Date('2026-01-01').getTime()
  if (new Date(output.scheduled_at).getTime() > futureThreshold) score += 1

  return score
}

describe('LLM-as-judge evaluation', () => {
  it('E-01: pickup response scores ≥ 4/5 on judge criteria', async () => {
    mockCallGroq.mockResolvedValueOnce(
      JSON.stringify({
        method: 'pickup',
        scheduled_at: '2026-04-26T10:00:00Z',
        location: { lat: 42.36, lng: -71.06, label: "Lender's front porch, Cambridge MA" },
        notes: 'Please ring the bell and bring your own bag.',
      })
    )
    const result = await runLogistics(MINIMAL_INPUT)
    expect(scoreLogisticsOutput(result)).toBeGreaterThanOrEqual(4)
  })

  it('E-02: digital method response scores ≥ 4/5 on judge criteria', async () => {
    mockCallGroq.mockResolvedValueOnce(
      JSON.stringify({
        method: 'digital',
        scheduled_at: '2026-04-24T14:00:00Z',
        notes: 'Send the file via the in-app chat once the trade is confirmed.',
      })
    )
    const result = await runLogistics({
      ...MINIMAL_INPUT,
      listing_title: 'Photoshop preset pack',
      listing_description: 'Digital file — instant delivery.',
    })
    expect(result.location).toBeUndefined()
    expect(scoreLogisticsOutput(result)).toBeGreaterThanOrEqual(4)
  })

  it('E-03: location label does not contain raw PII digits', async () => {
    mockCallGroq.mockResolvedValueOnce(
      JSON.stringify({
        method: 'pickup',
        scheduled_at: '2026-04-25T09:00:00Z',
        location: { lat: 42.36, lng: -71.06, label: 'Front porch, green mailbox' },
        notes: 'Coordinate via in-app chat for exact timing.',
      })
    )
    const result = await runLogistics(MINIMAL_INPUT)
    expect(result.location?.label).not.toMatch(/\d{7,}/)
  })
})
