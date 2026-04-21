// src/lib/agents/__tests__/groq-client.test.ts
// Unit tests for the Groq client wrapper.
// The groq-sdk is mocked — no live API calls are made in this suite.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// ---------------------------------------------------------------------------
// Hoist mock handles so they are accessible inside vi.mock factories,
// which are hoisted above all imports by Vitest.
// ---------------------------------------------------------------------------
const { mockCreate } = vi.hoisted(() => ({ mockCreate: vi.fn() }))

vi.mock('groq-sdk', () => ({
  default: vi.fn().mockImplementation(() => ({
    chat: { completions: { create: mockCreate } },
  })),
}))

import { callGroq, GroqError } from '../groq-client'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Build a minimal ChatCompletion response shape that groq-client expects. */
function stubCompletion(content: string | null | undefined) {
  return {
    choices: [{ message: { content } }],
  }
}

const SYSTEM = 'You are a helpful assistant.'
const USER = 'Hello, world.'

// ---------------------------------------------------------------------------
// Save and restore GROQ_API_KEY across tests that manipulate it.
// ---------------------------------------------------------------------------
let savedKey: string | undefined

beforeEach(() => {
  vi.clearAllMocks()
  savedKey = process.env.GROQ_API_KEY
  process.env.GROQ_API_KEY = 'gsk_test-key'
})

afterEach(() => {
  if (savedKey === undefined) {
    delete process.env.GROQ_API_KEY
  } else {
    process.env.GROQ_API_KEY = savedKey
  }
})

// ---------------------------------------------------------------------------
// A — GroqError class
// ---------------------------------------------------------------------------
describe('A — GroqError', () => {
  it('is an instance of Error', () => {
    const err = new GroqError('something went wrong')
    expect(err).toBeInstanceOf(Error)
  })

  it('has name "GroqError"', () => {
    const err = new GroqError('test')
    expect(err.name).toBe('GroqError')
  })

  it('stores the message', () => {
    const err = new GroqError('rate limit exceeded')
    expect(err.message).toBe('rate limit exceeded')
  })

  it('stores an optional cause', () => {
    const cause = new Error('network error')
    const err = new GroqError('wrapped', cause)
    expect(err.cause).toBe(cause)
  })
})

// ---------------------------------------------------------------------------
// B — Missing GROQ_API_KEY guard
// ---------------------------------------------------------------------------
describe('B — missing GROQ_API_KEY guard', () => {
  it('throws GroqError when GROQ_API_KEY is not set', async () => {
    delete process.env.GROQ_API_KEY
    await expect(callGroq(SYSTEM, USER)).rejects.toBeInstanceOf(GroqError)
  })

  it('error message mentions GROQ_API_KEY', async () => {
    delete process.env.GROQ_API_KEY
    await expect(callGroq(SYSTEM, USER)).rejects.toThrow(/GROQ_API_KEY/)
  })

  it('error message advises against NEXT_PUBLIC_ prefix', async () => {
    delete process.env.GROQ_API_KEY
    await expect(callGroq(SYSTEM, USER)).rejects.toThrow(/NEXT_PUBLIC_/)
  })
})

// ---------------------------------------------------------------------------
// C — Groq SDK error wrapping
// ---------------------------------------------------------------------------
describe('C — Groq SDK error wrapping', () => {
  it('throws GroqError when the Groq SDK throws', async () => {
    mockCreate.mockRejectedValueOnce(new Error('upstream 500'))
    await expect(callGroq(SYSTEM, USER)).rejects.toBeInstanceOf(GroqError)
  })

  it('wraps the original SDK error as the cause', async () => {
    const sdkError = new Error('rate limit')
    mockCreate.mockRejectedValueOnce(sdkError)

    let caught: GroqError | undefined
    try {
      await callGroq(SYSTEM, USER)
    } catch (err) {
      caught = err as GroqError
    }

    expect(caught).toBeInstanceOf(GroqError)
    expect(caught?.cause).toBe(sdkError)
  })
})

// ---------------------------------------------------------------------------
// D — Empty / missing response content
// ---------------------------------------------------------------------------
describe('D — empty response content', () => {
  it('throws GroqError when content is an empty string', async () => {
    mockCreate.mockResolvedValueOnce(stubCompletion(''))
    await expect(callGroq(SYSTEM, USER)).rejects.toBeInstanceOf(GroqError)
  })

  it('throws GroqError when content is whitespace-only', async () => {
    mockCreate.mockResolvedValueOnce(stubCompletion('   \n  '))
    await expect(callGroq(SYSTEM, USER)).rejects.toBeInstanceOf(GroqError)
  })

  it('throws GroqError when content is null', async () => {
    mockCreate.mockResolvedValueOnce(stubCompletion(null))
    await expect(callGroq(SYSTEM, USER)).rejects.toBeInstanceOf(GroqError)
  })

  it('throws GroqError when content is undefined', async () => {
    mockCreate.mockResolvedValueOnce(stubCompletion(undefined))
    await expect(callGroq(SYSTEM, USER)).rejects.toBeInstanceOf(GroqError)
  })

  it('throws GroqError when choices array is empty', async () => {
    mockCreate.mockResolvedValueOnce({ choices: [] })
    await expect(callGroq(SYSTEM, USER)).rejects.toBeInstanceOf(GroqError)
  })
})

// ---------------------------------------------------------------------------
// E — Successful response
// ---------------------------------------------------------------------------
describe('E — successful response', () => {
  it('returns the content string from the Groq response', async () => {
    mockCreate.mockResolvedValueOnce(stubCompletion('{"verdict":"allow"}'))
    const result = await callGroq(SYSTEM, USER)
    expect(result).toBe('{"verdict":"allow"}')
  })

  it('resolves without throwing on a valid response', async () => {
    mockCreate.mockResolvedValueOnce(stubCompletion('ok'))
    await expect(callGroq(SYSTEM, USER)).resolves.toBeDefined()
  })
})

// ---------------------------------------------------------------------------
// F — Prompt forwarding to the Groq SDK
// ---------------------------------------------------------------------------
describe('F — prompt forwarding', () => {
  it('passes system prompt as the first message with role "system"', async () => {
    mockCreate.mockResolvedValueOnce(stubCompletion('ok'))
    await callGroq('My system prompt', 'My user prompt')

    const callArgs = mockCreate.mock.calls[0][0] as {
      messages: { role: string; content: string }[]
    }
    const systemMsg = callArgs.messages.find((m) => m.role === 'system')
    expect(systemMsg?.content).toBe('My system prompt')
  })

  it('passes user prompt as the second message with role "user"', async () => {
    mockCreate.mockResolvedValueOnce(stubCompletion('ok'))
    await callGroq('sys', 'My user prompt')

    const callArgs = mockCreate.mock.calls[0][0] as {
      messages: { role: string; content: string }[]
    }
    const userMsg = callArgs.messages.find((m) => m.role === 'user')
    expect(userMsg?.content).toBe('My user prompt')
  })

  it('uses the default model when no model argument is provided', async () => {
    mockCreate.mockResolvedValueOnce(stubCompletion('ok'))
    await callGroq(SYSTEM, USER)

    const callArgs = mockCreate.mock.calls[0][0] as { model: string }
    expect(callArgs.model).toBe('llama3-8b-8192')
  })

  it('forwards a custom model argument to the Groq SDK', async () => {
    mockCreate.mockResolvedValueOnce(stubCompletion('ok'))
    await callGroq(SYSTEM, USER, 'llama3-70b-8192')

    const callArgs = mockCreate.mock.calls[0][0] as { model: string }
    expect(callArgs.model).toBe('llama3-70b-8192')
  })

  it('uses low temperature (≤ 0.2) for deterministic verdicts', async () => {
    mockCreate.mockResolvedValueOnce(stubCompletion('ok'))
    await callGroq(SYSTEM, USER)

    const callArgs = mockCreate.mock.calls[0][0] as { temperature: number }
    expect(callArgs.temperature).toBeLessThanOrEqual(0.2)
  })
})
