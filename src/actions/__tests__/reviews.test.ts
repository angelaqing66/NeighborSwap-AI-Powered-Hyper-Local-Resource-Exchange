// src/actions/__tests__/reviews.test.ts
// Unit tests for submitReviewAction.

import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── Mocks ─────────────────────────────────────────────────────────────────────

const mockGetUser = vi.fn()
const mockRunSentiment = vi.fn()

// Trade fetch: from('trades').select().eq().single()
const mockTradeSingle = vi.fn()
const mockTradeEq = vi.fn().mockReturnValue({ single: mockTradeSingle })
const mockTradeSelect = vi.fn().mockReturnValue({ eq: mockTradeEq })

// Review check: from('reviews').select().eq().eq().maybeSingle()
// and insert: from('reviews').insert()
const mockReviewMaybeSingle = vi.fn()
const mockReviewCheckEq2 = vi.fn().mockReturnValue({ maybeSingle: mockReviewMaybeSingle })
const mockReviewCheckEq1 = vi.fn().mockReturnValue({ eq: mockReviewCheckEq2 })
const mockReviewCheckSelect = vi.fn().mockReturnValue({ eq: mockReviewCheckEq1 })
const mockReviewInsert = vi.fn()

// RPC call for recalculate_trust_score
const mockRpc = vi.fn()

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn().mockResolvedValue({
    auth: { getUser: mockGetUser },
    from: vi.fn().mockImplementation((table: string) => {
      if (table === 'trades') {
        return { select: mockTradeSelect }
      }
      if (table === 'reviews') {
        return { select: mockReviewCheckSelect, insert: mockReviewInsert }
      }
      return {}
    }),
    rpc: mockRpc,
  }),
}))

vi.mock('@/lib/agents/sentiment', () => ({
  runSentiment: mockRunSentiment,
}))

// Lazy import AFTER mocks are hoisted
const { submitReviewAction } = await import('../reviews')

// ── Fixtures ──────────────────────────────────────────────────────────────────

const TRADE_ID = 'trade-review-001'
const INITIATOR_ID = 'user-initiator-001'
const COUNTERPARTY_ID = 'user-counterparty-001'

function makeCompletedTrade() {
  return {
    id: TRADE_ID,
    status: 'completed',
    initiator_id: INITIATOR_ID,
    counterparty_id: COUNTERPARTY_ID,
  }
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('submitReviewAction', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    // Default: authenticated as counterparty (lender)
    mockGetUser.mockResolvedValue({ data: { user: { id: COUNTERPARTY_ID } } })

    // Default: completed trade
    mockTradeSingle.mockResolvedValue({ data: makeCompletedTrade(), error: null })

    // Default: no existing review
    mockReviewMaybeSingle.mockResolvedValue({ data: null, error: null })

    // Default: insert succeeds
    mockReviewInsert.mockResolvedValue({ error: null })

    // Default: rpc succeeds
    mockRpc.mockResolvedValue({ error: null })

    // Default: sentiment agent returns a score
    mockRunSentiment.mockResolvedValue({
      sentiment_score: 80,
      confidence: 0.9,
      reasoning: 'Positive review.',
    })
  })

  // ── Auth ────────────────────────────────────────────────────────────────────

  it('returns error when user is not authenticated', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } })
    const result = await submitReviewAction(TRADE_ID, 4, 'Great!')
    expect(result.error).toMatch(/signed in/i)
    expect(mockReviewInsert).not.toHaveBeenCalled()
  })

  // ── Input validation ────────────────────────────────────────────────────────

  it('returns error when tradeId is empty', async () => {
    const result = await submitReviewAction('', 4, 'Great!')
    expect(result.error).toMatch(/trade id/i)
    expect(mockReviewInsert).not.toHaveBeenCalled()
  })

  it('returns error when score is below 1', async () => {
    const result = await submitReviewAction(TRADE_ID, 0, null)
    expect(result.error).toMatch(/1 and 100/i)
    expect(mockReviewInsert).not.toHaveBeenCalled()
  })

  it('returns error when score is above 100', async () => {
    const result = await submitReviewAction(TRADE_ID, 101, null)
    expect(result.error).toMatch(/1 and 100/i)
    expect(mockReviewInsert).not.toHaveBeenCalled()
  })

  it('returns error when score is not an integer', async () => {
    const result = await submitReviewAction(TRADE_ID, 50.5, null)
    expect(result.error).toMatch(/1 and 100/i)
    expect(mockReviewInsert).not.toHaveBeenCalled()
  })

  // ── Trade not found ─────────────────────────────────────────────────────────

  it('returns error when trade is not found', async () => {
    mockTradeSingle.mockResolvedValue({ data: null, error: { message: 'not found' } })
    const result = await submitReviewAction(TRADE_ID, 4, 'Great!')
    expect(result.error).toMatch(/trade not found/i)
    expect(mockReviewInsert).not.toHaveBeenCalled()
  })

  // ── Trade not completed ─────────────────────────────────────────────────────

  it('returns error when trade is not completed (pending_offer)', async () => {
    mockTradeSingle.mockResolvedValue({
      data: { ...makeCompletedTrade(), status: 'pending_offer' },
      error: null,
    })
    const result = await submitReviewAction(TRADE_ID, 4, 'Great!')
    expect(result.error).toMatch(/completed/i)
    expect(mockReviewInsert).not.toHaveBeenCalled()
  })

  it('returns error when trade is not completed (in_progress)', async () => {
    mockTradeSingle.mockResolvedValue({
      data: { ...makeCompletedTrade(), status: 'in_progress' },
      error: null,
    })
    const result = await submitReviewAction(TRADE_ID, 4, null)
    expect(result.error).toMatch(/completed/i)
    expect(mockReviewInsert).not.toHaveBeenCalled()
  })

  // ── Party restrictions ──────────────────────────────────────────────────────

  it('allows initiator to review (reviewee is counterparty)', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: INITIATOR_ID } } })
    const result = await submitReviewAction(TRADE_ID, 75, 'Great!')
    expect(result.error).toBeNull()
    const payload = mockReviewInsert.mock.calls[0][0] as Record<string, unknown>
    expect(payload.reviewer_id).toBe(INITIATOR_ID)
    expect(payload.reviewee_id).toBe(COUNTERPARTY_ID)
  })

  it('returns error when user is unrelated to the trade', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'stranger-user-999' } } })
    const result = await submitReviewAction(TRADE_ID, 50, 'Great!')
    expect(result.error).toMatch(/not a party/i)
    expect(mockReviewInsert).not.toHaveBeenCalled()
  })

  // ── Duplicate review ────────────────────────────────────────────────────────

  it('returns error when review already exists', async () => {
    mockReviewMaybeSingle.mockResolvedValue({ data: { id: 'existing-review-123' }, error: null })
    const result = await submitReviewAction(TRADE_ID, 5, 'Amazing!')
    expect(result.error).toMatch(/already submitted/i)
    expect(mockReviewInsert).not.toHaveBeenCalled()
  })

  it('returns error on 23505 unique_violation (race condition)', async () => {
    mockReviewInsert.mockResolvedValue({
      error: { code: '23505', message: 'duplicate key value' },
    })
    const result = await submitReviewAction(TRADE_ID, 4, 'Great!')
    expect(result.error).toMatch(/already submitted/i)
  })

  // ── Happy path ──────────────────────────────────────────────────────────────

  it('returns { error: null } on success with comment', async () => {
    const result = await submitReviewAction(TRADE_ID, 4, 'Great experience!')
    expect(result.error).toBeNull()
  })

  it('returns { error: null } on success without comment', async () => {
    const result = await submitReviewAction(TRADE_ID, 5, null)
    expect(result.error).toBeNull()
  })

  it('inserts the review with correct fields', async () => {
    await submitReviewAction(TRADE_ID, 4, 'Great experience!')
    expect(mockReviewInsert).toHaveBeenCalledOnce()
    const payload = mockReviewInsert.mock.calls[0][0] as Record<string, unknown>
    expect(payload.trade_id).toBe(TRADE_ID)
    expect(payload.reviewer_id).toBe(COUNTERPARTY_ID)
    expect(payload.reviewee_id).toBe(INITIATOR_ID)
    expect(payload.score).toBe(4)
    expect(payload.comment).toBe('Great experience!')
  })

  it('calls recalculate_trust_score with the reviewee (initiator) id', async () => {
    await submitReviewAction(TRADE_ID, 4, null)
    expect(mockRpc).toHaveBeenCalledWith('recalculate_trust_score', { p_user_id: INITIATOR_ID })
  })

  // ── Sentiment agent ─────────────────────────────────────────────────────────

  it('calls sentiment agent when comment is provided', async () => {
    await submitReviewAction(TRADE_ID, 4, 'Great experience!')
    expect(mockRunSentiment).toHaveBeenCalledOnce()
    const sentimentInput = mockRunSentiment.mock.calls[0][0] as Record<string, unknown>
    expect(sentimentInput.star_rating).toBe(4)
    expect(sentimentInput.comment).toBe('Great experience!')
    expect(sentimentInput.review_id).toBe('pending')
  })

  it('does not call sentiment agent when comment is null', async () => {
    await submitReviewAction(TRADE_ID, 5, null)
    expect(mockRunSentiment).not.toHaveBeenCalled()
  })

  it('does not call sentiment agent when comment is empty string', async () => {
    await submitReviewAction(TRADE_ID, 5, '')
    expect(mockRunSentiment).not.toHaveBeenCalled()
  })

  it('stores sentiment_score from agent in the review insert payload', async () => {
    mockRunSentiment.mockResolvedValue({
      sentiment_score: 88,
      confidence: 0.92,
      reasoning: 'Very positive.',
    })
    await submitReviewAction(TRADE_ID, 4, 'Excellent!')
    const payload = mockReviewInsert.mock.calls[0][0] as Record<string, unknown>
    expect(payload.sentiment_score).toBe(88)
  })

  it('stores null sentiment_score when no comment is provided', async () => {
    await submitReviewAction(TRADE_ID, 3, null)
    const payload = mockReviewInsert.mock.calls[0][0] as Record<string, unknown>
    expect(payload.sentiment_score).toBeNull()
  })

  // ── DB failure ──────────────────────────────────────────────────────────────

  it('returns error when review insert fails', async () => {
    mockReviewInsert.mockResolvedValue({
      error: { code: '42501', message: 'permission denied' },
    })
    const result = await submitReviewAction(TRADE_ID, 4, 'Great!')
    expect(result.error).toMatch(/failed to submit/i)
  })
})
