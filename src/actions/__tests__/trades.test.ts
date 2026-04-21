// src/actions/__tests__/trades.test.ts
// Unit tests for createTradeAction.

import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── Mocks ─────────────────────────────────────────────────────────────────────

const mockGetUser = vi.fn()
const mockSingle = vi.fn()
const mockSelect = vi.fn().mockReturnValue({ single: mockSingle })
const mockInsert = vi.fn().mockReturnValue({ select: mockSelect })

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn().mockResolvedValue({
    auth: { getUser: mockGetUser },
    from: vi.fn().mockReturnValue({ insert: mockInsert }),
  }),
}))

const mockRedirect = vi.fn()
vi.mock('next/navigation', () => ({
  redirect: mockRedirect,
}))

// Lazy import AFTER mocks are hoisted
const { createTradeAction } = await import('../trades')

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeFormData(fields: Record<string, string>): FormData {
  const fd = new FormData()
  for (const [key, value] of Object.entries(fields)) {
    fd.append(key, value)
  }
  return fd
}

const prevState = { error: null }
const AUTHED_USER = { id: 'user-initiator-123' }
const ITEM_ID = 'item-abc-456'
const COUNTERPARTY_ID = 'user-provider-789'
const NEW_TRADE_ID = 'trade-new-1'

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('createTradeAction', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetUser.mockResolvedValue({ data: { user: AUTHED_USER }, error: null })
    mockSingle.mockResolvedValue({ data: { id: NEW_TRADE_ID }, error: null })
  })

  // ── Auth ───────────────────────────────────────────────────────────────────

  it('returns error when user is not authenticated', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null })

    const fd = makeFormData({ item_id: ITEM_ID, counterparty_id: COUNTERPARTY_ID })
    const result = await createTradeAction(prevState, fd)

    expect(result.error).toMatch(/signed in/i)
    expect(mockInsert).not.toHaveBeenCalled()
  })

  // ── Validation ─────────────────────────────────────────────────────────────

  it('returns error when item_id is missing', async () => {
    const fd = makeFormData({ counterparty_id: COUNTERPARTY_ID })
    const result = await createTradeAction(prevState, fd)

    expect(result.error).toMatch(/item/i)
    expect(mockInsert).not.toHaveBeenCalled()
  })

  it('returns error when counterparty_id is missing', async () => {
    const fd = makeFormData({ item_id: ITEM_ID })
    const result = await createTradeAction(prevState, fd)

    expect(result.error).toMatch(/provider/i)
    expect(mockInsert).not.toHaveBeenCalled()
  })

  it('returns error when initiator and counterparty are the same user', async () => {
    const fd = makeFormData({ item_id: ITEM_ID, counterparty_id: AUTHED_USER.id })
    const result = await createTradeAction(prevState, fd)

    expect(result.error).toMatch(/yourself/i)
    expect(mockInsert).not.toHaveBeenCalled()
  })

  // ── DB ─────────────────────────────────────────────────────────────────────

  it('returns error when DB insert fails', async () => {
    mockSingle.mockResolvedValue({ data: null, error: { message: 'RLS violation' } })

    const fd = makeFormData({ item_id: ITEM_ID, counterparty_id: COUNTERPARTY_ID })
    const result = await createTradeAction(prevState, fd)

    expect(result.error).toMatch(/failed to create/i)
    expect(mockRedirect).not.toHaveBeenCalled()
  })

  it('inserts correct fields into trades table', async () => {
    const fd = makeFormData({ item_id: ITEM_ID, counterparty_id: COUNTERPARTY_ID })
    await createTradeAction(prevState, fd)

    const insertPayload = mockInsert.mock.calls[0][0]
    expect(insertPayload.initiator_id).toBe(AUTHED_USER.id)
    expect(insertPayload.counterparty_id).toBe(COUNTERPARTY_ID)
    expect(insertPayload.item_id).toBe(ITEM_ID)
    expect(insertPayload.status).toBe('pending_offer')
  })

  it('redirects to /chat/[tradeId] on success', async () => {
    const fd = makeFormData({ item_id: ITEM_ID, counterparty_id: COUNTERPARTY_ID })
    await createTradeAction(prevState, fd)

    expect(mockRedirect).toHaveBeenCalledWith(`/chat/${NEW_TRADE_ID}`)
  })
})
