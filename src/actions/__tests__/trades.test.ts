// src/actions/__tests__/trades.test.ts
// Unit tests for createTradeAction and updateTradeStatusAction.

import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── Mocks ─────────────────────────────────────────────────────────────────────

const mockGetUser = vi.fn()
const mockEmitToRoom = vi.fn()
const mockRedirect = vi.fn()

// createTradeAction chain: from('trades').insert({}).select('id').single()
const mockInsertSingle = vi.fn()
const mockInsertSelect = vi.fn().mockReturnValue({ single: mockInsertSingle })
const mockInsert = vi.fn().mockReturnValue({ select: mockInsertSelect })

// updateTradeStatusAction — fetch: from('trades').select('...').eq().single()
const mockFetchSingle = vi.fn()
const mockFetchEq = vi.fn().mockReturnValue({ single: mockFetchSingle })
const mockFetchSelect = vi.fn().mockReturnValue({ eq: mockFetchEq })

// updateTradeStatusAction — update: from('trades').update({}).eq()
const mockUpdateEq = vi.fn()
const mockUpdate = vi.fn().mockReturnValue({ eq: mockUpdateEq })

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn().mockResolvedValue({
    auth: { getUser: mockGetUser },
    from: vi.fn().mockReturnValue({
      insert: mockInsert,
      select: mockFetchSelect,
      update: mockUpdate,
    }),
  }),
}))

vi.mock('@/lib/socket/emitter', () => ({ emitToRoom: mockEmitToRoom }))
vi.mock('next/navigation', () => ({ redirect: mockRedirect }))

// Lazy import AFTER mocks are hoisted
const { createTradeAction, updateTradeStatusAction } = await import('../trades')

// ── Fixtures ──────────────────────────────────────────────────────────────────

function makeFormData(fields: Record<string, string>): FormData {
  const fd = new FormData()
  for (const [key, value] of Object.entries(fields)) fd.append(key, value)
  return fd
}

const CREATE_PREV_STATE = { error: null }

// createTradeAction fixtures
const CREATE_USER = { id: 'user-initiator-123' }
const CREATE_ITEM_ID = 'item-abc-456'
const CREATE_COUNTERPARTY_ID = 'user-provider-789'
const NEW_TRADE_ID = 'trade-new-1'

// updateTradeStatusAction fixtures
const TRADE_ID = 'trade-uuid-001'
const INITIATOR_ID = 'user-initiator-001'
const COUNTERPARTY_ID = 'user-counterparty-001'

function makeTrade(status = 'pending_offer') {
  return { status, initiator_id: INITIATOR_ID, counterparty_id: COUNTERPARTY_ID }
}

// ── createTradeAction ─────────────────────────────────────────────────────────

describe('createTradeAction', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetUser.mockResolvedValue({ data: { user: CREATE_USER }, error: null })
    mockInsertSingle.mockResolvedValue({ data: { id: NEW_TRADE_ID }, error: null })
  })

  it('returns error when user is not authenticated', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null })
    const result = await createTradeAction(
      CREATE_PREV_STATE,
      makeFormData({ item_id: CREATE_ITEM_ID, counterparty_id: CREATE_COUNTERPARTY_ID })
    )
    expect(result.error).toMatch(/signed in/i)
    expect(mockInsert).not.toHaveBeenCalled()
  })

  it('returns error when item_id is missing', async () => {
    const result = await createTradeAction(
      CREATE_PREV_STATE,
      makeFormData({ counterparty_id: CREATE_COUNTERPARTY_ID })
    )
    expect(result.error).toMatch(/item/i)
    expect(mockInsert).not.toHaveBeenCalled()
  })

  it('returns error when counterparty_id is missing', async () => {
    const result = await createTradeAction(
      CREATE_PREV_STATE,
      makeFormData({ item_id: CREATE_ITEM_ID })
    )
    expect(result.error).toMatch(/provider/i)
    expect(mockInsert).not.toHaveBeenCalled()
  })

  it('returns error when initiator and counterparty are the same user', async () => {
    const result = await createTradeAction(
      CREATE_PREV_STATE,
      makeFormData({ item_id: CREATE_ITEM_ID, counterparty_id: CREATE_USER.id })
    )
    expect(result.error).toMatch(/yourself/i)
    expect(mockInsert).not.toHaveBeenCalled()
  })

  it('returns error when DB insert fails', async () => {
    mockInsertSingle.mockResolvedValue({ data: null, error: { message: 'RLS violation' } })
    const result = await createTradeAction(
      CREATE_PREV_STATE,
      makeFormData({ item_id: CREATE_ITEM_ID, counterparty_id: CREATE_COUNTERPARTY_ID })
    )
    expect(result.error).toMatch(/failed to create/i)
    expect(mockRedirect).not.toHaveBeenCalled()
  })

  it('inserts correct fields into trades table', async () => {
    await createTradeAction(
      CREATE_PREV_STATE,
      makeFormData({ item_id: CREATE_ITEM_ID, counterparty_id: CREATE_COUNTERPARTY_ID })
    )
    const payload = mockInsert.mock.calls[0][0]
    expect(payload.initiator_id).toBe(CREATE_USER.id)
    expect(payload.counterparty_id).toBe(CREATE_COUNTERPARTY_ID)
    expect(payload.item_id).toBe(CREATE_ITEM_ID)
    expect(payload.status).toBe('pending_offer')
  })

  it('redirects to /chat/[tradeId] on success', async () => {
    await createTradeAction(
      CREATE_PREV_STATE,
      makeFormData({ item_id: CREATE_ITEM_ID, counterparty_id: CREATE_COUNTERPARTY_ID })
    )
    expect(mockRedirect).toHaveBeenCalledWith(`/chat/${NEW_TRADE_ID}`)
  })
})

// ── updateTradeStatusAction ───────────────────────────────────────────────────

describe('updateTradeStatusAction', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Default: authenticated as initiator
    mockGetUser.mockResolvedValue({ data: { user: { id: INITIATOR_ID } } })
    // Default trade: negotiating (middle of flow, allows many transitions)
    mockFetchSingle.mockResolvedValue({ data: makeTrade('negotiating'), error: null })
    mockUpdateEq.mockResolvedValue({ error: null })
  })

  // ── Auth ────────────────────────────────────────────────────────────────────

  it('returns error when not authenticated', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } })
    const result = await updateTradeStatusAction(TRADE_ID, 'accepted')
    expect(result.error).toMatch(/not authenticated/i)
    expect(mockUpdate).not.toHaveBeenCalled()
  })

  // ── Trade lookup ────────────────────────────────────────────────────────────

  it('returns error when trade is not found', async () => {
    mockFetchSingle.mockResolvedValue({ data: null, error: { message: 'not found' } })
    const result = await updateTradeStatusAction(TRADE_ID, 'accepted')
    expect(result.error).toMatch(/trade not found/i)
    expect(mockUpdate).not.toHaveBeenCalled()
  })

  it('returns error when user is not a party to the trade', async () => {
    mockFetchSingle.mockResolvedValue({
      data: { status: 'negotiating', initiator_id: 'other-1', counterparty_id: 'other-2' },
      error: null,
    })
    const result = await updateTradeStatusAction(TRADE_ID, 'accepted')
    expect(result.error).toMatch(/not authorized/i)
    expect(mockUpdate).not.toHaveBeenCalled()
  })

  // ── State machine validation ────────────────────────────────────────────────

  it('returns error when transitioning from a terminal status', async () => {
    mockFetchSingle.mockResolvedValue({ data: makeTrade('completed'), error: null })
    const result = await updateTradeStatusAction(TRADE_ID, 'in_progress')
    expect(result.error).toMatch(/cannot transition/i)
    expect(mockUpdate).not.toHaveBeenCalled()
  })

  it('returns error for an invalid transition path (pending_offer → completed)', async () => {
    mockFetchSingle.mockResolvedValue({ data: makeTrade('pending_offer'), error: null })
    const result = await updateTradeStatusAction(TRADE_ID, 'completed')
    expect(result.error).toMatch(/cannot transition/i)
    expect(mockUpdate).not.toHaveBeenCalled()
  })

  it('returns error for an invalid transition path (in_progress → accepted)', async () => {
    mockFetchSingle.mockResolvedValue({ data: makeTrade('in_progress'), error: null })
    const result = await updateTradeStatusAction(TRADE_ID, 'accepted')
    expect(result.error).toMatch(/cannot transition/i)
    expect(mockUpdate).not.toHaveBeenCalled()
  })

  // ── Role-based permission ───────────────────────────────────────────────────

  it('returns error when initiator tries to start negotiating (counterparty-only)', async () => {
    mockFetchSingle.mockResolvedValue({ data: makeTrade('pending_offer'), error: null })
    // mockGetUser already returns INITIATOR_ID
    const result = await updateTradeStatusAction(TRADE_ID, 'negotiating')
    expect(result.error).toMatch(/counterparty/i)
    expect(mockUpdate).not.toHaveBeenCalled()
  })

  it('allows the counterparty to start negotiating', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: COUNTERPARTY_ID } } })
    mockFetchSingle.mockResolvedValue({ data: makeTrade('pending_offer'), error: null })
    const result = await updateTradeStatusAction(TRADE_ID, 'negotiating')
    expect(result.error).toBeNull()
  })

  it('allows the initiator to cancel from pending_offer', async () => {
    mockFetchSingle.mockResolvedValue({ data: makeTrade('pending_offer'), error: null })
    const result = await updateTradeStatusAction(TRADE_ID, 'cancelled')
    expect(result.error).toBeNull()
  })

  it('allows the initiator to accept from negotiating', async () => {
    // mockFetchSingle default is 'negotiating'
    const result = await updateTradeStatusAction(TRADE_ID, 'accepted')
    expect(result.error).toBeNull()
  })

  it('allows the counterparty to accept from negotiating', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: COUNTERPARTY_ID } } })
    const result = await updateTradeStatusAction(TRADE_ID, 'accepted')
    expect(result.error).toBeNull()
  })

  it('allows both parties to mark in_progress from accepted', async () => {
    mockFetchSingle.mockResolvedValue({ data: makeTrade('accepted'), error: null })
    const result = await updateTradeStatusAction(TRADE_ID, 'in_progress')
    expect(result.error).toBeNull()
  })

  it('allows both parties to mark completed from in_progress', async () => {
    mockFetchSingle.mockResolvedValue({ data: makeTrade('in_progress'), error: null })
    const result = await updateTradeStatusAction(TRADE_ID, 'completed')
    expect(result.error).toBeNull()
  })

  it('allows both parties to dispute from in_progress', async () => {
    mockFetchSingle.mockResolvedValue({ data: makeTrade('in_progress'), error: null })
    const result = await updateTradeStatusAction(TRADE_ID, 'disputed')
    expect(result.error).toBeNull()
  })

  // ── Lifecycle timestamps ────────────────────────────────────────────────────

  it('sets accepted_at when transitioning to accepted', async () => {
    const result = await updateTradeStatusAction(TRADE_ID, 'accepted')
    expect(result.error).toBeNull()
    const payload = mockUpdate.mock.calls[0][0] as Record<string, unknown>
    expect(payload.accepted_at).toMatch(/^\d{4}-\d{2}-\d{2}T/)
  })

  it('sets completed_at when transitioning to completed', async () => {
    mockFetchSingle.mockResolvedValue({ data: makeTrade('in_progress'), error: null })
    const result = await updateTradeStatusAction(TRADE_ID, 'completed')
    expect(result.error).toBeNull()
    const payload = mockUpdate.mock.calls[0][0] as Record<string, unknown>
    expect(payload.completed_at).toMatch(/^\d{4}-\d{2}-\d{2}T/)
  })

  it('sets cancelled_at when transitioning to cancelled', async () => {
    mockFetchSingle.mockResolvedValue({ data: makeTrade('pending_offer'), error: null })
    const result = await updateTradeStatusAction(TRADE_ID, 'cancelled')
    expect(result.error).toBeNull()
    const payload = mockUpdate.mock.calls[0][0] as Record<string, unknown>
    expect(payload.cancelled_at).toMatch(/^\d{4}-\d{2}-\d{2}T/)
  })

  it('does not set lifecycle timestamps for non-milestone transitions', async () => {
    mockFetchSingle.mockResolvedValue({ data: makeTrade('accepted'), error: null })
    await updateTradeStatusAction(TRADE_ID, 'in_progress')
    const payload = mockUpdate.mock.calls[0][0] as Record<string, unknown>
    expect(payload.accepted_at).toBeUndefined()
    expect(payload.completed_at).toBeUndefined()
    expect(payload.cancelled_at).toBeUndefined()
  })

  // ── DB failure ──────────────────────────────────────────────────────────────

  it('returns error when DB update fails', async () => {
    mockUpdateEq.mockResolvedValue({ error: { message: 'constraint violation' } })
    const result = await updateTradeStatusAction(TRADE_ID, 'accepted')
    expect(result.error).toMatch(/failed to update/i)
    expect(mockEmitToRoom).not.toHaveBeenCalled()
  })

  // ── Socket emission ─────────────────────────────────────────────────────────

  it('emits the trade status event after a successful update', async () => {
    await updateTradeStatusAction(TRADE_ID, 'accepted')
    expect(mockEmitToRoom).toHaveBeenCalledOnce()
    const [room, , payload] = mockEmitToRoom.mock.calls[0] as [
      string,
      string,
      Record<string, unknown>,
    ]
    expect(room).toBe(`trade:${TRADE_ID}`)
    expect(payload.trade_id).toBe(TRADE_ID)
    expect(payload.status).toBe('accepted')
    expect(payload.updated_at as string).toMatch(/^\d{4}-\d{2}-\d{2}T/)
  })

  it('does not emit when DB update fails', async () => {
    mockUpdateEq.mockResolvedValue({ error: { message: 'error' } })
    await updateTradeStatusAction(TRADE_ID, 'accepted')
    expect(mockEmitToRoom).not.toHaveBeenCalled()
  })

  // ── Update payload ──────────────────────────────────────────────────────────

  it('includes the correct status in the DB update payload', async () => {
    await updateTradeStatusAction(TRADE_ID, 'accepted')
    const payload = mockUpdate.mock.calls[0][0] as Record<string, unknown>
    expect(payload.status).toBe('accepted')
  })
})
