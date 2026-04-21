// src/lib/agents/__tests__/runner.test.ts
// TDD tests for the parallel agent runner.
// All three agent modules are mocked — no live Groq calls are made.

import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { SafetyAgentOutput } from '../safety'
import type { LogisticsAgentOutput } from '../logistics'
import type { VibeAgentOutput } from '../vibe'
import type { AgentRunnerInput, AgentRunnerResult } from '../runner'

vi.mock('@/lib/agents/safety', () => ({ runSafety: vi.fn() }))
vi.mock('@/lib/agents/logistics', () => ({ runLogistics: vi.fn() }))
vi.mock('@/lib/agents/vibe', () => ({ runVibe: vi.fn() }))

import { runAgents } from '../runner'
import { runSafety } from '@/lib/agents/safety'
import { runLogistics } from '@/lib/agents/logistics'
import { runVibe } from '@/lib/agents/vibe'

const mockRunSafety = vi.mocked(runSafety)
const mockRunLogistics = vi.mocked(runLogistics)
const mockRunVibe = vi.mocked(runVibe)

// ---------------------------------------------------------------------------
// Shared fixtures
// ---------------------------------------------------------------------------

const MINIMAL_INPUT: AgentRunnerInput = {
  trade_id: 'trade-runner-001',
  initiator_id: 'user-runner-abc',
  listing_title: 'Garden hose, barely used',
  listing_description: 'A 50-foot garden hose in good condition.',
  agreed_terms: 'Pickup at front porch on Saturday morning.',
}

const SAFETY_ALLOW_OUTPUT: SafetyAgentOutput = {
  verdict: 'allow',
  confidence: 0.97,
  reasoning: 'Content is clean. No PII or prohibited items detected.',
  redacted_description: null,
}

const SAFETY_REVIEW_OUTPUT: SafetyAgentOutput = {
  verdict: 'review',
  confidence: 0.82,
  reasoning: 'Possible contact information found in the listing description.',
  redacted_description: 'Call me at [REDACTED] for details.',
}

const LOGISTICS_OUTPUT: LogisticsAgentOutput = {
  method: 'pickup',
  scheduled_at: '2026-04-26T10:00:00Z',
  location: { lat: 42.36, lng: -71.06, label: "Lender's front porch" },
  notes: 'Ring the bell on arrival.',
}

const VIBE_OUTPUT: VibeAgentOutput = {
  score: 78,
  confidence: 0.85,
  reasoning: 'Clear description and fair terms indicate a trustworthy exchange.',
}

beforeEach(() => {
  vi.clearAllMocks()
})

// ---------------------------------------------------------------------------
// A — Happy path: all agents resolve
// ---------------------------------------------------------------------------
describe('A — all agents resolve', () => {
  it('returns safety output when safety agent fulfills', async () => {
    mockRunSafety.mockResolvedValueOnce(SAFETY_ALLOW_OUTPUT)
    mockRunLogistics.mockResolvedValueOnce(LOGISTICS_OUTPUT)
    mockRunVibe.mockResolvedValueOnce(VIBE_OUTPUT)

    const result: AgentRunnerResult = await runAgents(MINIMAL_INPUT)

    expect(result.safety).toEqual(SAFETY_ALLOW_OUTPUT)
  })

  it('returns logistics output when logistics agent fulfills', async () => {
    mockRunSafety.mockResolvedValueOnce(SAFETY_ALLOW_OUTPUT)
    mockRunLogistics.mockResolvedValueOnce(LOGISTICS_OUTPUT)
    mockRunVibe.mockResolvedValueOnce(VIBE_OUTPUT)

    const result = await runAgents(MINIMAL_INPUT)

    expect(result.logistics).toEqual(LOGISTICS_OUTPUT)
  })

  it('returns vibe score (number) extracted from vibe agent output', async () => {
    mockRunSafety.mockResolvedValueOnce(SAFETY_ALLOW_OUTPUT)
    mockRunLogistics.mockResolvedValueOnce(LOGISTICS_OUTPUT)
    mockRunVibe.mockResolvedValueOnce(VIBE_OUTPUT)

    const result = await runAgents(MINIMAL_INPUT)

    expect(result.vibe).toBe(VIBE_OUTPUT.score)
  })

  it('returns an empty errors object when all agents succeed', async () => {
    mockRunSafety.mockResolvedValueOnce(SAFETY_ALLOW_OUTPUT)
    mockRunLogistics.mockResolvedValueOnce(LOGISTICS_OUTPUT)
    mockRunVibe.mockResolvedValueOnce(VIBE_OUTPUT)

    const result = await runAgents(MINIMAL_INPUT)

    expect(result.errors).toEqual({})
  })

  it('propagates a "review" verdict from the safety agent', async () => {
    mockRunSafety.mockResolvedValueOnce(SAFETY_REVIEW_OUTPUT)
    mockRunLogistics.mockResolvedValueOnce(LOGISTICS_OUTPUT)
    mockRunVibe.mockResolvedValueOnce(VIBE_OUTPUT)

    const result = await runAgents(MINIMAL_INPUT)

    expect(result.safety).toEqual(SAFETY_REVIEW_OUTPUT)
    expect(result.errors).toEqual({})
  })
})

// ---------------------------------------------------------------------------
// B — Safety agent rejects: logistics and vibe still succeed
// ---------------------------------------------------------------------------
describe('B — safety agent rejects', () => {
  it('sets result.safety to null when safety rejects', async () => {
    mockRunSafety.mockRejectedValueOnce(new Error('Groq timeout'))
    mockRunLogistics.mockResolvedValueOnce(LOGISTICS_OUTPUT)
    mockRunVibe.mockResolvedValueOnce(VIBE_OUTPUT)

    const result = await runAgents(MINIMAL_INPUT)

    expect(result.safety).toBeNull()
  })

  it('records the rejection reason in result.errors.safety', async () => {
    const groqError = new Error('Groq rate limit exceeded')
    mockRunSafety.mockRejectedValueOnce(groqError)
    mockRunLogistics.mockResolvedValueOnce(LOGISTICS_OUTPUT)
    mockRunVibe.mockResolvedValueOnce(VIBE_OUTPUT)

    const result = await runAgents(MINIMAL_INPUT)

    expect(result.errors.safety).toBe(groqError)
  })

  it('does not set errors.logistics or errors.vibe when only safety rejects', async () => {
    mockRunSafety.mockRejectedValueOnce(new Error('Groq timeout'))
    mockRunLogistics.mockResolvedValueOnce(LOGISTICS_OUTPUT)
    mockRunVibe.mockResolvedValueOnce(VIBE_OUTPUT)

    const result = await runAgents(MINIMAL_INPUT)

    expect(result.errors).not.toHaveProperty('logistics')
    expect(result.errors).not.toHaveProperty('vibe')
  })

  it('logistics and vibe still resolve when only safety rejects', async () => {
    mockRunSafety.mockRejectedValueOnce(new Error('Groq timeout'))
    mockRunLogistics.mockResolvedValueOnce(LOGISTICS_OUTPUT)
    mockRunVibe.mockResolvedValueOnce(VIBE_OUTPUT)

    const result = await runAgents(MINIMAL_INPUT)

    expect(result.logistics).toEqual(LOGISTICS_OUTPUT)
    expect(result.vibe).toBe(VIBE_OUTPUT.score)
  })
})

// ---------------------------------------------------------------------------
// C — Individual agent rejections: others still succeed (Promise.allSettled)
// ---------------------------------------------------------------------------
describe('C — individual agent rejections', () => {
  it('logistics null and error recorded when logistics rejects', async () => {
    const err = new Error('Logistics Groq failure')
    mockRunSafety.mockResolvedValueOnce(SAFETY_ALLOW_OUTPUT)
    mockRunLogistics.mockRejectedValueOnce(err)
    mockRunVibe.mockResolvedValueOnce(VIBE_OUTPUT)

    const result = await runAgents(MINIMAL_INPUT)

    expect(result.logistics).toBeNull()
    expect(result.errors.logistics).toBe(err)
    expect(result.safety).toEqual(SAFETY_ALLOW_OUTPUT)
    expect(result.vibe).toBe(VIBE_OUTPUT.score)
  })

  it('vibe null and error recorded when vibe rejects', async () => {
    const err = new Error('Vibe Groq failure')
    mockRunSafety.mockResolvedValueOnce(SAFETY_ALLOW_OUTPUT)
    mockRunLogistics.mockResolvedValueOnce(LOGISTICS_OUTPUT)
    mockRunVibe.mockRejectedValueOnce(err)

    const result = await runAgents(MINIMAL_INPUT)

    expect(result.vibe).toBeNull()
    expect(result.errors.vibe).toBe(err)
    expect(result.safety).toEqual(SAFETY_ALLOW_OUTPUT)
    expect(result.logistics).toEqual(LOGISTICS_OUTPUT)
  })

  it('all fields null and all errors recorded when all agents reject', async () => {
    mockRunSafety.mockRejectedValueOnce(new Error('s'))
    mockRunLogistics.mockRejectedValueOnce(new Error('l'))
    mockRunVibe.mockRejectedValueOnce(new Error('v'))

    const result = await runAgents(MINIMAL_INPUT)

    expect(result.safety).toBeNull()
    expect(result.logistics).toBeNull()
    expect(result.vibe).toBeNull()
    expect(result.errors).toHaveProperty('safety')
    expect(result.errors).toHaveProperty('logistics')
    expect(result.errors).toHaveProperty('vibe')
  })
})

// ---------------------------------------------------------------------------
// D — runAgents never throws
// ---------------------------------------------------------------------------
describe('D — runAgents always resolves', () => {
  it('resolves (does not throw) when all agents reject with Error', async () => {
    mockRunSafety.mockRejectedValueOnce(new Error('Network error'))
    mockRunLogistics.mockRejectedValueOnce(new Error('Network error'))
    mockRunVibe.mockRejectedValueOnce(new Error('Network error'))

    await expect(runAgents(MINIMAL_INPUT)).resolves.toBeDefined()
  })

  it('resolves (does not throw) when agents reject with non-Error values', async () => {
    mockRunSafety.mockRejectedValueOnce('string rejection')
    mockRunLogistics.mockRejectedValueOnce(42)
    mockRunVibe.mockRejectedValueOnce(undefined)

    await expect(runAgents(MINIMAL_INPUT)).resolves.toBeDefined()
  })
})

// ---------------------------------------------------------------------------
// E — Result shape contract
// ---------------------------------------------------------------------------
describe('E — result shape', () => {
  it('always returns an object with safety, logistics, vibe, and errors keys', async () => {
    mockRunSafety.mockResolvedValueOnce(SAFETY_ALLOW_OUTPUT)
    mockRunLogistics.mockResolvedValueOnce(LOGISTICS_OUTPUT)
    mockRunVibe.mockResolvedValueOnce(VIBE_OUTPUT)

    const result = await runAgents(MINIMAL_INPUT)

    expect(result).toHaveProperty('safety')
    expect(result).toHaveProperty('logistics')
    expect(result).toHaveProperty('vibe')
    expect(result).toHaveProperty('errors')
  })

  it('vibe is a number (not an object) when vibe agent fulfills', async () => {
    mockRunSafety.mockResolvedValueOnce(SAFETY_ALLOW_OUTPUT)
    mockRunLogistics.mockResolvedValueOnce(LOGISTICS_OUTPUT)
    mockRunVibe.mockResolvedValueOnce(VIBE_OUTPUT)

    const result = await runAgents(MINIMAL_INPUT)

    expect(typeof result.vibe).toBe('number')
  })

  it('errors is a plain object (not an array) even when empty', async () => {
    mockRunSafety.mockResolvedValueOnce(SAFETY_ALLOW_OUTPUT)
    mockRunLogistics.mockResolvedValueOnce(LOGISTICS_OUTPUT)
    mockRunVibe.mockResolvedValueOnce(VIBE_OUTPUT)

    const result = await runAgents(MINIMAL_INPUT)

    expect(typeof result.errors).toBe('object')
    expect(Array.isArray(result.errors)).toBe(false)
  })

  it('handles agreed_terms: null without error', async () => {
    mockRunSafety.mockResolvedValueOnce(SAFETY_ALLOW_OUTPUT)
    mockRunLogistics.mockResolvedValueOnce(LOGISTICS_OUTPUT)
    mockRunVibe.mockResolvedValueOnce(VIBE_OUTPUT)

    const inputWithNullTerms: AgentRunnerInput = { ...MINIMAL_INPUT, agreed_terms: null }
    const result = await runAgents(inputWithNullTerms)

    expect(result.safety).toEqual(SAFETY_ALLOW_OUTPUT)
    expect(result.errors).toEqual({})
  })
})

// ---------------------------------------------------------------------------
// F — Input forwarding
// ---------------------------------------------------------------------------
describe('F — input forwarding', () => {
  it('forwards the full AgentRunnerInput to runSafety', async () => {
    mockRunSafety.mockResolvedValueOnce(SAFETY_ALLOW_OUTPUT)
    mockRunLogistics.mockResolvedValueOnce(LOGISTICS_OUTPUT)
    mockRunVibe.mockResolvedValueOnce(VIBE_OUTPUT)

    await runAgents(MINIMAL_INPUT)

    expect(mockRunSafety).toHaveBeenCalledOnce()
    expect(mockRunSafety).toHaveBeenCalledWith(MINIMAL_INPUT)
  })

  it('calls each agent exactly once per runAgents invocation', async () => {
    mockRunSafety.mockResolvedValue(SAFETY_ALLOW_OUTPUT)
    mockRunLogistics.mockResolvedValue(LOGISTICS_OUTPUT)
    mockRunVibe.mockResolvedValue(VIBE_OUTPUT)

    await runAgents(MINIMAL_INPUT)

    expect(mockRunSafety).toHaveBeenCalledTimes(1)
    expect(mockRunLogistics).toHaveBeenCalledTimes(1)
    expect(mockRunVibe).toHaveBeenCalledTimes(1)
  })
})
