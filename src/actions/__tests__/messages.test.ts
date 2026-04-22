// src/actions/__tests__/messages.test.ts
// Unit tests for sendMessageAction.
// Mocks Supabase and socket emitter — never touches real DB or network.

import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── Mocks ────────────────────────────────────────────────────────────────────

const mockGetUser = vi.fn()
const mockTradeSingle = vi.fn()
const mockEmitToRoom = vi.fn()
const mockRunMessageSafety = vi.fn()

// Chain: from('trades').select(...).eq('id', x).single()
const mockTradeEq = vi.fn()
const mockTradeSelect = vi.fn()
mockTradeSelect.mockReturnValue({ eq: mockTradeEq })
mockTradeEq.mockReturnValue({ single: mockTradeSingle })

// insert(...) is awaited directly — mockResolvedValue makes it return a Promise
const mockMessageInsert = vi.fn()

vi.mock('@/lib/socket/emitter', () => ({ emitToRoom: mockEmitToRoom }))

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn().mockResolvedValue({
    auth: { getUser: mockGetUser },
    from: vi.fn().mockImplementation((table: string) => {
      if (table === 'trades') return { select: mockTradeSelect }
      if (table === 'messages') return { insert: mockMessageInsert }
      return {}
    }),
  }),
}))

vi.mock('@/lib/agents/safety', () => ({
  runMessageSafety: mockRunMessageSafety,
}))

// Lazy import AFTER mocks are hoisted
const { sendMessageAction } = await import('../messages')

// ── Fixtures ─────────────────────────────────────────────────────────────────

const TRADE_ID = 'trade-abc-123'
const USER_ID = 'user-sender-456'
const COUNTERPARTY_ID = 'user-other-789'
const CONTENT = 'Hello, is the bike still available?'
const STORED_MESSAGE = {
  id: 'msg-uuid-001',
  trade_id: TRADE_ID,
  sender_id: USER_ID,
  content: CONTENT,
  sent_at: '2026-04-21T00:00:00Z',
  created_at: '2026-04-21T00:00:00Z',
}
const TRADE = { initiator_id: USER_ID, counterparty_id: COUNTERPARTY_ID }
const AUTHED_USER = { id: USER_ID }

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('sendMessageAction', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetUser.mockResolvedValue({ data: { user: AUTHED_USER } })
    mockTradeSingle.mockResolvedValue({ data: TRADE, error: null })
    // insert() is awaited directly — resolve to success by default
    mockMessageInsert.mockResolvedValue({ error: null })
    // Restore chain returns after clearAllMocks
    mockTradeSelect.mockReturnValue({ eq: mockTradeEq })
    mockTradeEq.mockReturnValue({ single: mockTradeSingle })
    // Default safety mock: clean message, no redaction
    mockRunMessageSafety.mockResolvedValue({
      verdict: 'allow',
      confidence: 0.99,
      reasoning: 'No issues found.',
      redacted_content: CONTENT,
      has_phishing_link: false,
    })
  })

  // ── Input validation ────────────────────────────────────────────────────────

  it('returns error when content is empty string', async () => {
    const result = await sendMessageAction(TRADE_ID, '')
    expect(result.error).toMatch(/empty/i)
    expect(mockMessageInsert).not.toHaveBeenCalled()
  })

  it('returns error when content is whitespace only', async () => {
    const result = await sendMessageAction(TRADE_ID, '   ')
    expect(result.error).toMatch(/empty/i)
    expect(mockMessageInsert).not.toHaveBeenCalled()
  })

  it('returns error when content exceeds 2000 characters', async () => {
    const result = await sendMessageAction(TRADE_ID, 'a'.repeat(2001))
    expect(result.error).toMatch(/long/i)
    expect(mockMessageInsert).not.toHaveBeenCalled()
  })

  it('accepts content at the 2000-character limit', async () => {
    const result = await sendMessageAction(TRADE_ID, 'a'.repeat(2000))
    expect(result.error).toBeNull()
  })

  // ── Auth ────────────────────────────────────────────────────────────────────

  it('returns error when user is not authenticated', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } })
    const result = await sendMessageAction(TRADE_ID, CONTENT)
    expect(result.error).toMatch(/signed in/i)
    expect(mockMessageInsert).not.toHaveBeenCalled()
  })

  // ── Authorization ───────────────────────────────────────────────────────────

  it('returns error when trade is not found', async () => {
    mockTradeSingle.mockResolvedValue({ data: null, error: { message: 'not found' } })
    const result = await sendMessageAction(TRADE_ID, CONTENT)
    expect(result.error).toMatch(/trade not found/i)
    expect(mockMessageInsert).not.toHaveBeenCalled()
  })

  it('returns error when user is not a party to the trade', async () => {
    mockTradeSingle.mockResolvedValue({
      data: { initiator_id: 'other-user-1', counterparty_id: 'other-user-2' },
      error: null,
    })
    const result = await sendMessageAction(TRADE_ID, CONTENT)
    expect(result.error).toMatch(/not a party/i)
    expect(mockMessageInsert).not.toHaveBeenCalled()
  })

  it('allows the counterparty to send a message', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: COUNTERPARTY_ID } } })
    const result = await sendMessageAction(TRADE_ID, CONTENT)
    expect(result.error).toBeNull()
  })

  // ── DB ──────────────────────────────────────────────────────────────────────

  it('returns error when DB insert fails', async () => {
    mockMessageInsert.mockResolvedValueOnce({ error: { message: 'RLS violation', code: '42501' } })
    const result = await sendMessageAction(TRADE_ID, CONTENT)
    expect(result.error).toMatch(/failed to send/i)
    expect(mockEmitToRoom).not.toHaveBeenCalled()
  })

  it('inserts correct fields into messages table', async () => {
    await sendMessageAction(TRADE_ID, CONTENT)
    const insertPayload = mockMessageInsert.mock.calls[0][0]
    expect(insertPayload.trade_id).toBe(TRADE_ID)
    expect(insertPayload.sender_id).toBe(USER_ID)
    expect(insertPayload.content).toBe(CONTENT)
    expect(insertPayload.sent_at).toMatch(/^\d{4}-\d{2}-\d{2}T/)
  })

  it('trims leading and trailing whitespace from content before storing', async () => {
    await sendMessageAction(TRADE_ID, `  ${CONTENT}  `)
    const insertPayload = mockMessageInsert.mock.calls[0][0]
    expect(insertPayload.content).toBe(CONTENT)
  })

  // ── Socket emission ─────────────────────────────────────────────────────────

  it('emits to the correct trade room after successful insert', async () => {
    await sendMessageAction(TRADE_ID, CONTENT)
    expect(mockEmitToRoom).toHaveBeenCalledOnce()
    const [room] = mockEmitToRoom.mock.calls[0]
    expect(room).toBe(`trade:${TRADE_ID}`)
  })

  it('emits the message payload with correct fields', async () => {
    await sendMessageAction(TRADE_ID, CONTENT)
    const [, , payload] = mockEmitToRoom.mock.calls[0]
    expect(payload).toMatchObject({
      trade_id: TRADE_ID,
      sender_id: USER_ID,
      content: CONTENT,
    })
    expect((payload as Record<string, unknown>).id).toMatch(/^[0-9a-f-]{36}$/)
    expect((payload as Record<string, unknown>).sent_at).toMatch(/^\d{4}-\d{2}-\d{2}T/)
  })

  it('does not emit when DB insert fails', async () => {
    mockMessageInsert.mockResolvedValueOnce({ error: { message: 'error', code: 'XX000' } })
    await sendMessageAction(TRADE_ID, CONTENT)
    expect(mockEmitToRoom).not.toHaveBeenCalled()
  })

  // ── Success ─────────────────────────────────────────────────────────────────

  it('returns the stored message on success', async () => {
    const result = await sendMessageAction(TRADE_ID, CONTENT)
    expect(result.error).toBeNull()
    expect(result.message).toMatchObject({
      trade_id: TRADE_ID,
      sender_id: USER_ID,
      content: CONTENT,
    })
    // id is a pre-generated UUID — just verify it looks like one
    expect(result.message?.id).toMatch(/^[0-9a-f-]{36}$/)
  })

  it('returns safety_flags on success', async () => {
    const result = await sendMessageAction(TRADE_ID, CONTENT)
    expect(result.safety_flags).toBeDefined()
    expect(result.safety_flags?.verdict).toBe('allow')
    expect(result.safety_flags?.was_redacted).toBe(false)
    expect(result.safety_flags?.has_phishing_link).toBe(false)
  })

  // ── Safety scanning ─────────────────────────────────────────────────────────

  it('blocks message when safety agent returns block verdict', async () => {
    mockRunMessageSafety.mockResolvedValueOnce({
      verdict: 'block',
      confidence: 0.92,
      reasoning: 'Phishing link detected.',
      redacted_content: 'Click here: http://paypa1.com',
      has_phishing_link: true,
    })

    const result = await sendMessageAction(TRADE_ID, 'Click here: http://paypa1.com')
    expect(result.error).toMatch(/blocked/i)
    expect(mockMessageInsert).not.toHaveBeenCalled()
    expect(mockEmitToRoom).not.toHaveBeenCalled()
  })

  it('stores redacted_content when safety agent redacts PII', async () => {
    const rawContent = 'Call me at 408-555-0199 to arrange pickup.'
    const redactedContent = 'Call me at [REDACTED] to arrange pickup.'

    mockRunMessageSafety.mockResolvedValueOnce({
      verdict: 'review',
      confidence: 0.88,
      reasoning: 'Phone number redacted.',
      redacted_content: redactedContent,
      has_phishing_link: false,
    })

    await sendMessageAction(TRADE_ID, rawContent)

    const insertPayload = mockMessageInsert.mock.calls[0][0]
    expect(insertPayload.content).toBe(redactedContent)
    expect(insertPayload.content).not.toContain('408-555-0199')
  })

  it('emits redacted_content (not raw content) to socket room', async () => {
    const rawContent = 'My SSN is 123-45-6789.'
    const redactedContent = 'My SSN is [REDACTED].'

    mockRunMessageSafety.mockResolvedValueOnce({
      verdict: 'review',
      confidence: 0.9,
      reasoning: 'SSN redacted.',
      redacted_content: redactedContent,
      has_phishing_link: false,
    })

    await sendMessageAction(TRADE_ID, rawContent)

    const [, , emittedPayload] = mockEmitToRoom.mock.calls[0]
    expect((emittedPayload as Record<string, unknown>).content).toBe(redactedContent)
    expect((emittedPayload as Record<string, unknown>).content).not.toContain('123-45-6789')
  })

  it('returns was_redacted: true when content was changed by safety agent', async () => {
    mockRunMessageSafety.mockResolvedValueOnce({
      verdict: 'review',
      confidence: 0.88,
      reasoning: 'Email address redacted.',
      redacted_content: 'Email me at [REDACTED].',
      has_phishing_link: false,
    })

    const result = await sendMessageAction(TRADE_ID, 'Email me at alice@example.com.')
    expect(result.safety_flags?.was_redacted).toBe(true)
  })

  it('returns has_phishing_link: true when safety agent flags a suspicious URL', async () => {
    mockRunMessageSafety.mockResolvedValueOnce({
      verdict: 'review',
      confidence: 0.75,
      reasoning: 'Ambiguous URL detected, routed for review.',
      redacted_content: 'Check this out: http://amaz0n.xyz',
      has_phishing_link: true,
    })

    const result = await sendMessageAction(TRADE_ID, 'Check this out: http://amaz0n.xyz')
    expect(result.safety_flags?.has_phishing_link).toBe(true)
  })

  it('passes trade_id and sender_id to runMessageSafety', async () => {
    await sendMessageAction(TRADE_ID, CONTENT)

    expect(mockRunMessageSafety).toHaveBeenCalledWith(
      expect.objectContaining({
        trade_id: TRADE_ID,
        sender_id: USER_ID,
        content: CONTENT,
      })
    )
  })
})
