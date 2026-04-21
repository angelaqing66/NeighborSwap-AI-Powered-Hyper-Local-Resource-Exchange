// src/lib/agents/__tests__/runner.test.ts
// TDD tests for the parallel agent runner.
// The safety agent module is mocked — no live Groq calls are made.

import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { SafetyAgentOutput } from '../safety'
import type { AgentRunnerInput, AgentRunnerResult } from '../runner'

// ---------------------------------------------------------------------------
// Mock the safety agent module.
// logistics and vibe are internal stubs inside runner.ts and always return
// null, so there is nothing to mock for them.
// ---------------------------------------------------------------------------
vi.mock('@/lib/agents/safety', () => ({
  runSafety: vi.fn(),
}))

import { runAgents } from '../runner'
import { runSafety } from '@/lib/agents/safety'

const mockRunSafety = vi.mocked(runSafety)

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

beforeEach(() => {
  vi.clearAllMocks()
})

// ---------------------------------------------------------------------------
// A — Happy path: all agents resolve
// ---------------------------------------------------------------------------
describe('A — all agents resolve', () => {
  it('returns safety output when safety agent fulfills', async () => {
    mockRunSafety.mockResolvedValueOnce(SAFETY_ALLOW_OUTPUT)

    const result: AgentRunnerResult = await runAgents(MINIMAL_INPUT)

    expect(result.safety).toEqual(SAFETY_ALLOW_OUTPUT)
  })

  it('returns logistics: null because the logistics stub always resolves null', async () => {
    mockRunSafety.mockResolvedValueOnce(SAFETY_ALLOW_OUTPUT)

    const result = await runAgents(MINIMAL_INPUT)

    expect(result.logistics).toBeNull()
  })

  it('returns vibe: null because the vibe stub always resolves null', async () => {
    mockRunSafety.mockResolvedValueOnce(SAFETY_ALLOW_OUTPUT)

    const result = await runAgents(MINIMAL_INPUT)

    expect(result.vibe).toBeNull()
  })

  it('returns an empty errors object when all agents succeed', async () => {
    mockRunSafety.mockResolvedValueOnce(SAFETY_ALLOW_OUTPUT)

    const result = await runAgents(MINIMAL_INPUT)

    expect(result.errors).toEqual({})
  })

  it('propagates a "review" verdict from the safety agent', async () => {
    mockRunSafety.mockResolvedValueOnce(SAFETY_REVIEW_OUTPUT)

    const result = await runAgents(MINIMAL_INPUT)

    expect(result.safety).toEqual(SAFETY_REVIEW_OUTPUT)
    expect(result.errors).toEqual({})
  })
})

// ---------------------------------------------------------------------------
// B — Safety agent rejects
// ---------------------------------------------------------------------------
describe('B — safety agent rejects', () => {
  it('sets result.safety to null when safety rejects', async () => {
    mockRunSafety.mockRejectedValueOnce(new Error('Groq timeout'))

    const result = await runAgents(MINIMAL_INPUT)

    expect(result.safety).toBeNull()
  })

  it('records the rejection reason in result.errors.safety', async () => {
    const groqError = new Error('Groq rate limit exceeded')
    mockRunSafety.mockRejectedValueOnce(groqError)

    const result = await runAgents(MINIMAL_INPUT)

    expect(result.errors.safety).toBe(groqError)
  })

  it('does not set errors.logistics or errors.vibe when only safety rejects', async () => {
    mockRunSafety.mockRejectedValueOnce(new Error('Groq timeout'))

    const result = await runAgents(MINIMAL_INPUT)

    expect(result.errors).not.toHaveProperty('logistics')
    expect(result.errors).not.toHaveProperty('vibe')
  })

  it('keeps logistics and vibe as null when safety rejects', async () => {
    mockRunSafety.mockRejectedValueOnce(new Error('Groq timeout'))

    const result = await runAgents(MINIMAL_INPUT)

    expect(result.logistics).toBeNull()
    expect(result.vibe).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// C — runAgents never throws
// ---------------------------------------------------------------------------
describe('C — runAgents always resolves', () => {
  it('resolves (does not throw) when safety rejects with an Error', async () => {
    mockRunSafety.mockRejectedValueOnce(new Error('Network error'))

    await expect(runAgents(MINIMAL_INPUT)).resolves.toBeDefined()
  })

  it('resolves (does not throw) when safety rejects with a non-Error value', async () => {
    mockRunSafety.mockRejectedValueOnce('string rejection reason')

    await expect(runAgents(MINIMAL_INPUT)).resolves.toBeDefined()
  })

  it('resolves (does not throw) when safety rejects with undefined', async () => {
    mockRunSafety.mockRejectedValueOnce(undefined)

    await expect(runAgents(MINIMAL_INPUT)).resolves.toBeDefined()
  })
})

// ---------------------------------------------------------------------------
// D — Result shape contract
// ---------------------------------------------------------------------------
describe('D — result shape', () => {
  it('always returns an object with safety, logistics, vibe, and errors keys', async () => {
    mockRunSafety.mockResolvedValueOnce(SAFETY_ALLOW_OUTPUT)

    const result = await runAgents(MINIMAL_INPUT)

    expect(result).toHaveProperty('safety')
    expect(result).toHaveProperty('logistics')
    expect(result).toHaveProperty('vibe')
    expect(result).toHaveProperty('errors')
  })

  it('errors is a plain object (not an array) even when empty', async () => {
    mockRunSafety.mockResolvedValueOnce(SAFETY_ALLOW_OUTPUT)

    const result = await runAgents(MINIMAL_INPUT)

    expect(typeof result.errors).toBe('object')
    expect(Array.isArray(result.errors)).toBe(false)
  })

  it('errors is a plain object (not an array) when safety fails', async () => {
    mockRunSafety.mockRejectedValueOnce(new Error('fail'))

    const result = await runAgents(MINIMAL_INPUT)

    expect(typeof result.errors).toBe('object')
    expect(Array.isArray(result.errors)).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// E — Input forwarding
// ---------------------------------------------------------------------------
describe('E — input forwarding', () => {
  it('forwards the full AgentRunnerInput to runSafety', async () => {
    mockRunSafety.mockResolvedValueOnce(SAFETY_ALLOW_OUTPUT)

    await runAgents(MINIMAL_INPUT)

    expect(mockRunSafety).toHaveBeenCalledOnce()
    expect(mockRunSafety).toHaveBeenCalledWith(MINIMAL_INPUT)
  })

  it('calls runSafety exactly once per runAgents invocation', async () => {
    mockRunSafety.mockResolvedValue(SAFETY_ALLOW_OUTPUT)

    await runAgents(MINIMAL_INPUT)

    expect(mockRunSafety).toHaveBeenCalledTimes(1)
  })

  it('handles agreed_terms: null without error', async () => {
    mockRunSafety.mockResolvedValueOnce(SAFETY_ALLOW_OUTPUT)

    const inputWithNullTerms: AgentRunnerInput = { ...MINIMAL_INPUT, agreed_terms: null }
    const result = await runAgents(inputWithNullTerms)

    expect(result.safety).toEqual(SAFETY_ALLOW_OUTPUT)
    expect(result.errors).toEqual({})
  })
})
