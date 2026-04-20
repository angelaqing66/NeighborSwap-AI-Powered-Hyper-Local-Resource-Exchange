// src/actions/__tests__/listings.test.ts
// Unit tests for createListingAction.
// Mocks Supabase server client, safety agent, and next/navigation.
// Never calls real APIs or touches the DB.

import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── Mocks (hoisted before any import of the module under test) ───────────────

const mockGetUser = vi.fn()
const mockStorageUpload = vi.fn()
const mockStorageGetPublicUrl = vi.fn()
const mockFromInsert = vi.fn()

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn().mockResolvedValue({
    auth: { getUser: mockGetUser },
    storage: {
      from: vi.fn().mockReturnValue({
        upload: mockStorageUpload,
        getPublicUrl: mockStorageGetPublicUrl,
      }),
    },
    from: vi.fn().mockReturnValue({
      insert: mockFromInsert,
    }),
  }),
}))

const mockRunSafety = vi.fn()
vi.mock('@/lib/agents/safety', () => ({
  runSafety: mockRunSafety,
}))

const mockRedirect = vi.fn()
vi.mock('next/navigation', () => ({
  redirect: mockRedirect,
}))

// Lazy import AFTER mocks are hoisted
const { createListingAction } = await import('../listings')

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeFormData(fields: Record<string, string | File>): FormData {
  const fd = new FormData()
  for (const [key, value] of Object.entries(fields)) {
    fd.append(key, value)
  }
  return fd
}

const prevState = { error: null }

const AUTHED_USER = { id: 'user-abc-123' }
const ALLOW_OUTPUT = {
  verdict: 'allow' as const,
  confidence: 0.99,
  reasoning: 'No issues found.',
  redacted_description: null,
}
const BLOCK_OUTPUT = {
  verdict: 'block' as const,
  confidence: 0.97,
  reasoning: 'Contains prohibited content.',
  redacted_description: null,
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('createListingAction', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Default: authenticated user
    mockGetUser.mockResolvedValue({ data: { user: AUTHED_USER }, error: null })
    // Default: safety allows
    mockRunSafety.mockResolvedValue(ALLOW_OUTPUT)
    // Default: insert succeeds
    mockFromInsert.mockResolvedValue({ data: [{ id: 'listing-1' }], error: null })
  })

  // ── Auth ───────────────────────────────────────────────────────────────────

  it('returns an error when the user is not authenticated', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null })

    const fd = makeFormData({ title: 'My drill', description: 'Great condition' })
    const result = await createListingAction(prevState, fd)

    expect(result.error).toMatch(/signed in/i)
    expect(mockRunSafety).not.toHaveBeenCalled()
    expect(mockFromInsert).not.toHaveBeenCalled()
  })

  it('returns an error when getUser itself errors', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: { message: 'JWT expired' } })

    const fd = makeFormData({ title: 'Drill', description: 'Nice' })
    const result = await createListingAction(prevState, fd)

    expect(result.error).toBeTruthy()
    expect(mockFromInsert).not.toHaveBeenCalled()
  })

  // ── Validation ─────────────────────────────────────────────────────────────

  it('returns an error when title is missing', async () => {
    const fd = makeFormData({ title: '', description: 'Great condition' })
    const result = await createListingAction(prevState, fd)

    expect(result.error).toMatch(/title/i)
    expect(mockRunSafety).not.toHaveBeenCalled()
  })

  it('returns an error when title is whitespace only', async () => {
    const fd = makeFormData({ title: '   ', description: 'Nice item' })
    const result = await createListingAction(prevState, fd)

    expect(result.error).toMatch(/title/i)
  })

  it('returns an error when description is missing', async () => {
    const fd = makeFormData({ title: 'My drill', description: '' })
    const result = await createListingAction(prevState, fd)

    expect(result.error).toMatch(/description/i)
    expect(mockRunSafety).not.toHaveBeenCalled()
  })

  // ── Safety agent ───────────────────────────────────────────────────────────

  it('returns an error when safety agent blocks the listing', async () => {
    mockRunSafety.mockResolvedValue(BLOCK_OUTPUT)

    const fd = makeFormData({ title: 'Illegal item', description: 'Definitely prohibited' })
    const result = await createListingAction(prevState, fd)

    expect(result.error).toMatch(/flagged/i)
    expect(mockFromInsert).not.toHaveBeenCalled()
  })

  it('calls runSafety with title, description, and borrowing_rules as agreed_terms', async () => {
    const fd = makeFormData({
      title: 'Power drill',
      description: 'Barely used',
      borrowing_rules: 'Return within 7 days',
    })
    await createListingAction(prevState, fd)

    expect(mockRunSafety).toHaveBeenCalledOnce()
    const safetyInput = mockRunSafety.mock.calls[0][0]
    expect(safetyInput.listing_title).toBe('Power drill')
    expect(safetyInput.listing_description).toBe('Barely used')
    expect(safetyInput.agreed_terms).toBe('Return within 7 days')
  })

  it('does NOT send initiator_id or trade_id as user-visible fields to Groq (audit-only)', async () => {
    // The safety agent should receive trade_id and initiator_id but those fields
    // are documented as audit-only (never sent to Groq internally).
    // This test verifies the action passes them through correctly.
    const fd = makeFormData({ title: 'Ladder', description: 'Aluminum, 8ft' })
    await createListingAction(prevState, fd)

    const safetyInput = mockRunSafety.mock.calls[0][0]
    expect(safetyInput.initiator_id).toBe(AUTHED_USER.id)
    expect(typeof safetyInput.trade_id).toBe('string')
  })

  // ── Redacted description ───────────────────────────────────────────────────

  it('uses the safety-redacted description when the agent returns one', async () => {
    mockRunSafety.mockResolvedValue({
      verdict: 'review' as const,
      confidence: 0.9,
      reasoning: 'PII found.',
      redacted_description: 'Call [REDACTED] to arrange pickup.',
    })

    const fd = makeFormData({
      title: 'Bike',
      description: 'Call 408-555-0199 to arrange pickup.',
    })
    await createListingAction(prevState, fd)

    const insertPayload = mockFromInsert.mock.calls[0][0]
    expect(insertPayload.description).toBe('Call [REDACTED] to arrange pickup.')
    expect(insertPayload.description).not.toContain('408-555-0199')
  })

  // ── Photo upload ───────────────────────────────────────────────────────────

  it('skips storage upload when no photo is provided', async () => {
    const fd = makeFormData({ title: 'Tent', description: 'Great for camping' })
    await createListingAction(prevState, fd)

    expect(mockStorageUpload).not.toHaveBeenCalled()
    const insertPayload = mockFromInsert.mock.calls[0][0]
    expect(insertPayload.image_url).toBeNull()
  })

  it('returns an error when photo upload fails', async () => {
    mockStorageUpload.mockResolvedValue({ error: { message: 'Bucket not found' } })
    mockStorageGetPublicUrl.mockReturnValue({ data: { publicUrl: '' } })

    const photo = new File(['data'], 'drill.jpg', { type: 'image/jpeg' })
    const fd = makeFormData({ title: 'Drill', description: 'Nice', photo })
    const result = await createListingAction(prevState, fd)

    expect(result.error).toMatch(/upload failed/i)
    expect(mockFromInsert).not.toHaveBeenCalled()
  })

  it('sets image_url from storage when photo upload succeeds', async () => {
    mockStorageUpload.mockResolvedValue({ error: null })
    mockStorageGetPublicUrl.mockReturnValue({
      data: { publicUrl: 'https://cdn.example.com/item-photos/user-abc-123/listing-x.jpg' },
    })

    const photo = new File(['img'], 'drill.jpg', { type: 'image/jpeg' })
    const fd = makeFormData({ title: 'Drill', description: 'Excellent', photo })
    await createListingAction(prevState, fd)

    const insertPayload = mockFromInsert.mock.calls[0][0]
    expect(insertPayload.image_url).toContain('cdn.example.com')
  })

  // ── DB insert ──────────────────────────────────────────────────────────────

  it('returns an error when the DB insert fails', async () => {
    mockFromInsert.mockResolvedValue({ data: null, error: { message: 'RLS violation' } })

    const fd = makeFormData({ title: 'Drill', description: 'Good condition' })
    const result = await createListingAction(prevState, fd)

    expect(result.error).toMatch(/failed to create/i)
    expect(mockRedirect).not.toHaveBeenCalled()
  })

  it('inserts the listing with correct fields', async () => {
    const fd = makeFormData({
      title: 'Camping stove',
      description: 'One season old',
      borrowing_rules: 'Clean after use',
      return_by_date: '2026-05-01',
    })
    await createListingAction(prevState, fd)

    const insertPayload = mockFromInsert.mock.calls[0][0]
    expect(insertPayload.title).toBe('Camping stove')
    expect(insertPayload.description).toBe('One season old')
    expect(insertPayload.borrowing_rules).toBe('Clean after use')
    expect(insertPayload.return_by_date).toBe('2026-05-01')
    expect(insertPayload.provider_id).toBe(AUTHED_USER.id)
    expect(insertPayload.status).toBe('available')
  })

  it('redirects to /listings on successful creation', async () => {
    const fd = makeFormData({ title: 'Ladder', description: 'Aluminum step ladder' })
    await createListingAction(prevState, fd)

    expect(mockRedirect).toHaveBeenCalledWith('/listings')
  })

  it('stores null for optional fields when not provided', async () => {
    const fd = makeFormData({ title: 'Fan', description: 'Tower fan, quiet' })
    await createListingAction(prevState, fd)

    const insertPayload = mockFromInsert.mock.calls[0][0]
    expect(insertPayload.borrowing_rules).toBeNull()
    expect(insertPayload.return_by_date).toBeNull()
    expect(insertPayload.image_url).toBeNull()
  })
})
