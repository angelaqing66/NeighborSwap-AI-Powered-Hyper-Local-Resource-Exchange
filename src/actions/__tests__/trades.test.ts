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

// updateTradeStatusAction — fetch: from('trades').select('status,...').eq().single()
const mockFetchSingle = vi.fn()
const mockFetchEq = vi.fn().mockReturnValue({ single: mockFetchSingle })

// updateTradeStatusAction — conflict check: select('id').eq().neq().in().limit().maybeSingle()
const mockConflictMaybeSingle = vi.fn()
const mockConflictLimit = vi.fn().mockReturnValue({ maybeSingle: mockConflictMaybeSingle })
const mockConflictIn = vi.fn().mockReturnValue({ limit: mockConflictLimit })
const mockConflictNeq = vi.fn().mockReturnValue({ in: mockConflictIn })
const mockConflictEq = vi.fn().mockReturnValue({ neq: mockConflictNeq })

// Differentiate chains by column argument: 'id' → conflict check, anything else → fetch
const mockFetchSelect = vi.fn().mockImplementation((columns: string) => {
  if (columns === 'id') return { eq: mockConflictEq }
  return { eq: mockFetchEq }
})

// updateTradeStatusAction — update: from('trades').update({}).eq()
const mockUpdateEq = vi.fn()
const mockUpdate = vi.fn().mockReturnValue({ eq: mockUpdateEq })

// System event messages: from('messages').insert({})
const mockMessageInsert = vi.fn()

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn().mockResolvedValue({
    auth: { getUser: mockGetUser },
    from: vi.fn().mockImplementation((table: string) => {
      if (table === 'messages') return { insert: mockMessageInsert }
      // 'trades' — exposes all chains; each action uses the right starting method
      return { insert: mockInsert, select: mockFetchSelect, update: mockUpdate }
    }),
  }),
}))

vi.mock('@/lib/socket/emitter', () => ({ emitToRoom: mockEmitToRoom }))
vi.mock('next/navigation', () => ({ redirect: mockRedirect }))

// Lazy import AFTER mocks are hoisted
const { createTradeAction, updateTradeStatusAction, updateAgreedTermsAction } =
  await import('../trades')

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
const ITEM_ID = 'item-test-001'

function makeTrade(status = 'pending_offer') {
  return { status, initiator_id: INITIATOR_ID, counterparty_id: COUNTERPARTY_ID, item_id: ITEM_ID }
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
    mockMessageInsert.mockResolvedValue({ error: null })
    // Default: no competing active trade (conflict check returns null)
    mockConflictMaybeSingle.mockResolvedValue({ data: null, error: null })
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

  it('returns error when initiator tries to start inquiry (counterparty-only)', async () => {
    mockFetchSingle.mockResolvedValue({ data: makeTrade('pending_offer'), error: null })
    const result = await updateTradeStatusAction(TRADE_ID, 'negotiating')
    expect(result.error).toMatch(/counterparty/i)
    expect(mockUpdate).not.toHaveBeenCalled()
  })

  it('allows the counterparty to start inquiry', async () => {
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

  it('allows the initiator to request swap from negotiating', async () => {
    const result = await updateTradeStatusAction(TRADE_ID, 'accepted')
    expect(result.error).toBeNull()
  })

  it('allows the counterparty to request swap from negotiating', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: COUNTERPARTY_ID } } })
    const result = await updateTradeStatusAction(TRADE_ID, 'accepted')
    expect(result.error).toBeNull()
  })

  it('allows only the borrower (initiator) to confirm pickup from accepted', async () => {
    mockFetchSingle.mockResolvedValue({ data: makeTrade('accepted'), error: null })
    const result = await updateTradeStatusAction(TRADE_ID, 'in_progress')
    expect(result.error).toBeNull()
  })

  it('does not allow the lender (counterparty) to confirm pickup from accepted', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: COUNTERPARTY_ID } } })
    mockFetchSingle.mockResolvedValue({ data: makeTrade('accepted'), error: null })
    const result = await updateTradeStatusAction(TRADE_ID, 'in_progress')
    expect(result.error).toMatch(/initiator/)
  })

  it('allows only the lender (counterparty) to confirm return from in_progress', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: COUNTERPARTY_ID } } })
    mockFetchSingle.mockResolvedValue({ data: makeTrade('in_progress'), error: null })
    const result = await updateTradeStatusAction(TRADE_ID, 'completed')
    expect(result.error).toBeNull()
  })

  it('does not allow the borrower (initiator) to confirm return from in_progress', async () => {
    mockFetchSingle.mockResolvedValue({ data: makeTrade('in_progress'), error: null })
    const result = await updateTradeStatusAction(TRADE_ID, 'completed')
    expect(result.error).toMatch(/counterparty/)
  })

  it('allows both parties to dispute from in_progress', async () => {
    mockFetchSingle.mockResolvedValue({ data: makeTrade('in_progress'), error: null })
    const result = await updateTradeStatusAction(TRADE_ID, 'disputed')
    expect(result.error).toBeNull()
  })

  // ── Lifecycle timestamps ────────────────────────────────────────────────────

  it('sets accepted_at when transitioning to accepted', async () => {
    await updateTradeStatusAction(TRADE_ID, 'accepted')
    const payload = mockUpdate.mock.calls[0][0] as Record<string, unknown>
    expect(payload.accepted_at).toMatch(/^\d{4}-\d{2}-\d{2}T/)
  })

  it('sets completed_at when transitioning to completed', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: COUNTERPARTY_ID } } })
    mockFetchSingle.mockResolvedValue({ data: makeTrade('in_progress'), error: null })
    await updateTradeStatusAction(TRADE_ID, 'completed')
    const payload = mockUpdate.mock.calls[0][0] as Record<string, unknown>
    expect(payload.completed_at).toMatch(/^\d{4}-\d{2}-\d{2}T/)
  })

  it('sets cancelled_at when transitioning to cancelled', async () => {
    mockFetchSingle.mockResolvedValue({ data: makeTrade('pending_offer'), error: null })
    await updateTradeStatusAction(TRADE_ID, 'cancelled')
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

  // ── Duplicate active trade (conflict check) ─────────────────────────────────

  it('returns clear error when pre-flight conflict check finds an active trade', async () => {
    mockFetchSingle.mockResolvedValue({ data: makeTrade('accepted'), error: null })
    mockConflictMaybeSingle.mockResolvedValue({ data: { id: 'other-trade-999' }, error: null })
    const result = await updateTradeStatusAction(TRADE_ID, 'in_progress')
    expect(result.error).toMatch(/already part of an active trade/i)
    expect(mockUpdate).not.toHaveBeenCalled()
  })

  it('returns clear error for 23505 unique violation (race condition bypasses pre-flight)', async () => {
    mockFetchSingle.mockResolvedValue({ data: makeTrade('accepted'), error: null })
    // Pre-flight sees no conflict (race: another request wins between check and update)
    mockConflictMaybeSingle.mockResolvedValue({ data: null, error: null })
    mockUpdateEq.mockResolvedValue({
      error: { code: '23505', message: 'duplicate key value violates unique constraint' },
    })
    const result = await updateTradeStatusAction(TRADE_ID, 'in_progress')
    expect(result.error).toMatch(/already part of an active trade/i)
    expect(mockEmitToRoom).not.toHaveBeenCalled()
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
    const statusCalls = mockEmitToRoom.mock.calls.filter(([, event]) =>
      (event as string).startsWith(`trade:${TRADE_ID}:status`)
    )
    expect(statusCalls).toHaveLength(1)
    const [room, , payload] = statusCalls[0] as [string, string, Record<string, unknown>]
    expect(room).toBe(`trade:${TRADE_ID}`)
    expect(payload.status).toBe('accepted')
  })

  it('does not emit when DB update fails', async () => {
    mockUpdateEq.mockResolvedValue({ error: { message: 'error' } })
    await updateTradeStatusAction(TRADE_ID, 'accepted')
    expect(mockEmitToRoom).not.toHaveBeenCalled()
  })

  it('includes the correct status in the DB update payload', async () => {
    await updateTradeStatusAction(TRADE_ID, 'accepted')
    const payload = mockUpdate.mock.calls[0][0] as Record<string, unknown>
    expect(payload.status).toBe('accepted')
  })

  // ── System event messages ───────────────────────────────────────────────────

  it('inserts a system event message when transitioning to accepted', async () => {
    await updateTradeStatusAction(TRADE_ID, 'accepted')
    expect(mockMessageInsert).toHaveBeenCalledOnce()
    const msgPayload = mockMessageInsert.mock.calls[0][0] as Record<string, unknown>
    expect(msgPayload.trade_id).toBe(TRADE_ID)
    expect(msgPayload.event_type).toBe('status:accepted')
    expect(typeof msgPayload.content).toBe('string')
  })

  it('inserts a system event message when confirming pickup (in_progress)', async () => {
    mockFetchSingle.mockResolvedValue({ data: makeTrade('accepted'), error: null })
    await updateTradeStatusAction(TRADE_ID, 'in_progress')
    expect(mockMessageInsert).toHaveBeenCalledOnce()
    const msgPayload = mockMessageInsert.mock.calls[0][0] as Record<string, unknown>
    expect(msgPayload.event_type).toBe('status:in_progress')
  })

  it('inserts a system event message when confirming return (completed)', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: COUNTERPARTY_ID } } })
    mockFetchSingle.mockResolvedValue({ data: makeTrade('in_progress'), error: null })
    await updateTradeStatusAction(TRADE_ID, 'completed')
    expect(mockMessageInsert).toHaveBeenCalledOnce()
    const msgPayload = mockMessageInsert.mock.calls[0][0] as Record<string, unknown>
    expect(msgPayload.event_type).toBe('status:completed')
  })

  it('inserts a system event message when trade is cancelled', async () => {
    mockFetchSingle.mockResolvedValue({ data: makeTrade('pending_offer'), error: null })
    await updateTradeStatusAction(TRADE_ID, 'cancelled')
    expect(mockMessageInsert).toHaveBeenCalledOnce()
    const msgPayload = mockMessageInsert.mock.calls[0][0] as Record<string, unknown>
    expect(msgPayload.event_type).toBe('status:cancelled')
  })

  it('inserts a system event message when dispute is raised', async () => {
    mockFetchSingle.mockResolvedValue({ data: makeTrade('in_progress'), error: null })
    await updateTradeStatusAction(TRADE_ID, 'disputed')
    expect(mockMessageInsert).toHaveBeenCalledOnce()
    const msgPayload = mockMessageInsert.mock.calls[0][0] as Record<string, unknown>
    expect(msgPayload.event_type).toBe('status:disputed')
  })

  it('does not insert a system message for non-milestone transitions (negotiating)', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: COUNTERPARTY_ID } } })
    mockFetchSingle.mockResolvedValue({ data: makeTrade('pending_offer'), error: null })
    await updateTradeStatusAction(TRADE_ID, 'negotiating')
    expect(mockMessageInsert).not.toHaveBeenCalled()
  })

  it('emits a chatMessage socket event for milestone transitions', async () => {
    await updateTradeStatusAction(TRADE_ID, 'accepted')
    const chatCalls = mockEmitToRoom.mock.calls.filter(([, event]) =>
      (event as string).startsWith(`chat:${TRADE_ID}:message`)
    )
    expect(chatCalls).toHaveLength(1)
    const [, , payload] = chatCalls[0] as [string, string, Record<string, unknown>]
    expect(payload.event_type).toBe('status:accepted')
    expect(payload.trade_id).toBe(TRADE_ID)
  })

  it('does not emit a chatMessage event for non-milestone transitions', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: COUNTERPARTY_ID } } })
    mockFetchSingle.mockResolvedValue({ data: makeTrade('pending_offer'), error: null })
    await updateTradeStatusAction(TRADE_ID, 'negotiating')
    const chatCalls = mockEmitToRoom.mock.calls.filter(([, event]) =>
      (event as string).startsWith(`chat:${TRADE_ID}:message`)
    )
    expect(chatCalls).toHaveLength(0)
  })

  it('system event message uses the acting user id as sender_id', async () => {
    await updateTradeStatusAction(TRADE_ID, 'accepted')
    const msgPayload = mockMessageInsert.mock.calls[0][0] as Record<string, unknown>
    expect(msgPayload.sender_id).toBe(INITIATOR_ID)
  })

  // ── Reason field ────────────────────────────────────────────────────────────

  it('stores cancellation_reason in the update payload when reason is provided', async () => {
    mockFetchSingle.mockResolvedValue({ data: makeTrade('pending_offer'), error: null })
    await updateTradeStatusAction(TRADE_ID, 'cancelled', 'No longer needed')
    const payload = mockUpdate.mock.calls[0][0] as Record<string, unknown>
    expect(payload.cancellation_reason).toBe('No longer needed')
  })

  it('does not set cancellation_reason when no reason is provided', async () => {
    mockFetchSingle.mockResolvedValue({ data: makeTrade('pending_offer'), error: null })
    await updateTradeStatusAction(TRADE_ID, 'cancelled')
    const payload = mockUpdate.mock.calls[0][0] as Record<string, unknown>
    expect(payload.cancellation_reason).toBeUndefined()
  })

  it('stores dispute_reason in the update payload when reason is provided', async () => {
    mockFetchSingle.mockResolvedValue({ data: makeTrade('in_progress'), error: null })
    await updateTradeStatusAction(TRADE_ID, 'disputed', 'Item was damaged')
    const payload = mockUpdate.mock.calls[0][0] as Record<string, unknown>
    expect(payload.dispute_reason).toBe('Item was damaged')
  })

  it('does not set dispute_reason when no reason is provided', async () => {
    mockFetchSingle.mockResolvedValue({ data: makeTrade('in_progress'), error: null })
    await updateTradeStatusAction(TRADE_ID, 'disputed')
    const payload = mockUpdate.mock.calls[0][0] as Record<string, unknown>
    expect(payload.dispute_reason).toBeUndefined()
  })

  it('includes the reason in the system event message content', async () => {
    mockFetchSingle.mockResolvedValue({ data: makeTrade('pending_offer'), error: null })
    await updateTradeStatusAction(TRADE_ID, 'cancelled', 'Found another option')
    const msgPayload = mockMessageInsert.mock.calls[0][0] as Record<string, unknown>
    expect(msgPayload.content).toContain('Found another option')
  })

  it('trims whitespace from reason before storing', async () => {
    mockFetchSingle.mockResolvedValue({ data: makeTrade('pending_offer'), error: null })
    await updateTradeStatusAction(TRADE_ID, 'cancelled', '  changed my mind  ')
    const payload = mockUpdate.mock.calls[0][0] as Record<string, unknown>
    expect(payload.cancellation_reason).toBe('changed my mind')
  })

  it('ignores a blank-only reason (treats as no reason)', async () => {
    mockFetchSingle.mockResolvedValue({ data: makeTrade('pending_offer'), error: null })
    await updateTradeStatusAction(TRADE_ID, 'cancelled', '   ')
    const payload = mockUpdate.mock.calls[0][0] as Record<string, unknown>
    expect(payload.cancellation_reason).toBeUndefined()
    const msgPayload = mockMessageInsert.mock.calls[0][0] as Record<string, unknown>
    expect(msgPayload.content).toBe('Trade cancelled')
  })
})

// ── updateAgreedTermsAction ───────────────────────────────────────────────────

describe('updateAgreedTermsAction', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetUser.mockResolvedValue({ data: { user: { id: INITIATOR_ID } } })
    mockFetchSingle.mockResolvedValue({ data: makeTrade('negotiating'), error: null })
    mockUpdateEq.mockResolvedValue({ error: null })
  })

  // ── Auth ────────────────────────────────────────────────────────────────────

  it('returns error when not authenticated', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } })
    const result = await updateAgreedTermsAction(TRADE_ID, 'Borrow drill for 2 days')
    expect(result.error).toMatch(/not authenticated/i)
    expect(mockUpdate).not.toHaveBeenCalled()
  })

  // ── Input validation ────────────────────────────────────────────────────────

  it('returns error when terms is empty string', async () => {
    const result = await updateAgreedTermsAction(TRADE_ID, '')
    expect(result.error).toMatch(/cannot be empty/i)
    expect(mockUpdate).not.toHaveBeenCalled()
  })

  it('returns error when terms is whitespace-only', async () => {
    const result = await updateAgreedTermsAction(TRADE_ID, '   ')
    expect(result.error).toMatch(/cannot be empty/i)
    expect(mockUpdate).not.toHaveBeenCalled()
  })

  // ── Trade lookup ────────────────────────────────────────────────────────────

  it('returns error when trade is not found', async () => {
    mockFetchSingle.mockResolvedValue({ data: null, error: { message: 'not found' } })
    const result = await updateAgreedTermsAction(TRADE_ID, 'Borrow drill for 2 days')
    expect(result.error).toMatch(/trade not found/i)
    expect(mockUpdate).not.toHaveBeenCalled()
  })

  it('returns error when user is not a party to the trade', async () => {
    mockFetchSingle.mockResolvedValue({
      data: { status: 'negotiating', initiator_id: 'other-1', counterparty_id: 'other-2' },
      error: null,
    })
    const result = await updateAgreedTermsAction(TRADE_ID, 'Borrow drill for 2 days')
    expect(result.error).toMatch(/not authorized/i)
    expect(mockUpdate).not.toHaveBeenCalled()
  })

  // ── Contract lock enforcement ───────────────────────────────────────────────

  it('returns lock error when trade is accepted (contract locked)', async () => {
    mockFetchSingle.mockResolvedValue({ data: makeTrade('accepted'), error: null })
    const result = await updateAgreedTermsAction(TRADE_ID, 'Different terms')
    expect(result.error).toMatch(/locked/i)
    expect(mockUpdate).not.toHaveBeenCalled()
  })

  it('returns lock error when trade is in_progress', async () => {
    mockFetchSingle.mockResolvedValue({ data: makeTrade('in_progress'), error: null })
    const result = await updateAgreedTermsAction(TRADE_ID, 'Different terms')
    expect(result.error).toMatch(/locked/i)
    expect(mockUpdate).not.toHaveBeenCalled()
  })

  it('returns lock error when trade is completed (terminal)', async () => {
    mockFetchSingle.mockResolvedValue({ data: makeTrade('completed'), error: null })
    const result = await updateAgreedTermsAction(TRADE_ID, 'Different terms')
    expect(result.error).toMatch(/locked/i)
    expect(mockUpdate).not.toHaveBeenCalled()
  })

  it('returns lock error when trade is cancelled (terminal)', async () => {
    mockFetchSingle.mockResolvedValue({ data: makeTrade('cancelled'), error: null })
    const result = await updateAgreedTermsAction(TRADE_ID, 'Different terms')
    expect(result.error).toMatch(/locked/i)
    expect(mockUpdate).not.toHaveBeenCalled()
  })

  // ── Mutable phases ──────────────────────────────────────────────────────────

  it('allows terms update during negotiating phase', async () => {
    const result = await updateAgreedTermsAction(TRADE_ID, 'Borrow drill for 2 days')
    expect(result.error).toBeNull()
    expect(mockUpdate).toHaveBeenCalledOnce()
  })

  it('allows terms update during pending_offer phase', async () => {
    mockFetchSingle.mockResolvedValue({ data: makeTrade('pending_offer'), error: null })
    const result = await updateAgreedTermsAction(TRADE_ID, 'Borrow drill for 2 days')
    expect(result.error).toBeNull()
    expect(mockUpdate).toHaveBeenCalledOnce()
  })

  it('allows counterparty to update terms during negotiating', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: COUNTERPARTY_ID } } })
    const result = await updateAgreedTermsAction(TRADE_ID, 'Revised terms from counterparty')
    expect(result.error).toBeNull()
  })

  // ── DB payload ──────────────────────────────────────────────────────────────

  it('writes trimmed terms to the DB update payload', async () => {
    await updateAgreedTermsAction(TRADE_ID, '  Borrow drill for 2 days  ')
    const payload = mockUpdate.mock.calls[0][0] as Record<string, unknown>
    expect(payload.agreed_terms).toBe('Borrow drill for 2 days')
  })

  it('scopes the update to the correct trade row', async () => {
    await updateAgreedTermsAction(TRADE_ID, 'Borrow drill for 2 days')
    expect(mockUpdateEq).toHaveBeenCalledWith('id', TRADE_ID)
  })

  // ── DB-level check_violation (trigger fires) ────────────────────────────────

  it('maps 23514 check_violation to the locked error message', async () => {
    mockUpdateEq.mockResolvedValue({
      error: { code: '23514', message: 'agreed_terms is locked once the contract is accepted' },
    })
    const result = await updateAgreedTermsAction(TRADE_ID, 'Borrow drill for 2 days')
    expect(result.error).toMatch(/locked/i)
  })

  // ── Generic DB failure ──────────────────────────────────────────────────────

  it('returns generic error when DB fails for other reasons', async () => {
    mockUpdateEq.mockResolvedValue({ error: { code: '42501', message: 'permission denied' } })
    const result = await updateAgreedTermsAction(TRADE_ID, 'Borrow drill for 2 days')
    expect(result.error).toMatch(/failed to update agreed terms/i)
  })
})
