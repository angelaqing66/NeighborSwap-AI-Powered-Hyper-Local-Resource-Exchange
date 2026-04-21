// src/actions/__tests__/messages.test.ts
// Unit tests for sendMessageAction.
// Mocks Supabase and socket emitter — never touches real DB or network.

import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── Mocks ────────────────────────────────────────────────────────────────────

const mockGetUser = vi.fn()
const mockTradeSingle = vi.fn()
const mockMessageSingle = vi.fn()
const mockEmitToRoom = vi.fn()

// Chain: from('trades').select(...).eq('id', x).single()
const mockTradeEq = vi.fn()
const mockTradeSelect = vi.fn()
mockTradeSelect.mockReturnValue({ eq: mockTradeEq })
mockTradeEq.mockReturnValue({ single: mockTradeSingle })

// Chain: from('messages').insert(...).select().single()
const mockMessageSelect = vi.fn()
const mockMessageInsert = vi.fn()
mockMessageInsert.mockReturnValue({ select: mockMessageSelect })
mockMessageSelect.mockReturnValue({ single: mockMessageSingle })

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
    mockMessageSingle.mockResolvedValue({ data: STORED_MESSAGE, error: null })
    // Restore chain returns after clearAllMocks
    mockTradeSelect.mockReturnValue({ eq: mockTradeEq })
    mockTradeEq.mockReturnValue({ single: mockTradeSingle })
    mockMessageInsert.mockReturnValue({ select: mockMessageSelect })
    mockMessageSelect.mockReturnValue({ single: mockMessageSingle })
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
    mockMessageSingle.mockResolvedValue({ data: null, error: { message: 'RLS violation' } })
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
      id: STORED_MESSAGE.id,
      trade_id: TRADE_ID,
      sender_id: USER_ID,
      content: CONTENT,
    })
    expect((payload as Record<string, unknown>).sent_at).toMatch(/^\d{4}-\d{2}-\d{2}T/)
  })

  it('does not emit when DB insert fails', async () => {
    mockMessageSingle.mockResolvedValue({ data: null, error: { message: 'error' } })
    await sendMessageAction(TRADE_ID, CONTENT)
    expect(mockEmitToRoom).not.toHaveBeenCalled()
  })

  // ── Success ─────────────────────────────────────────────────────────────────

  it('returns the stored message on success', async () => {
    const result = await sendMessageAction(TRADE_ID, CONTENT)
    expect(result.error).toBeNull()
    expect(result.message).toMatchObject({
      id: STORED_MESSAGE.id,
      trade_id: TRADE_ID,
      sender_id: USER_ID,
      content: CONTENT,
    })
  })
})
