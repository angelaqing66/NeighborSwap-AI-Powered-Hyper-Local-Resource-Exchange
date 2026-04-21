// src/lib/__tests__/getListings.test.ts
// Unit tests for getListings query helper.
// Written BEFORE implementation — TDD red phase.

import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── Mock chain builder ────────────────────────────────────────────────────────
const mockOrder = vi.fn()
const mockIlike = vi.fn()
const mockEq = vi.fn()
const mockSelect = vi.fn()

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn().mockResolvedValue({
    from: vi.fn().mockReturnValue({ select: mockSelect }),
  }),
}))

// The chain: from('items').select('*').eq(...).order(...) [.ilike(...)]
// Each step returns the next mock so chaining works.
mockSelect.mockReturnValue({ eq: mockEq })
mockEq.mockReturnValue({ order: mockOrder, ilike: mockIlike })
mockOrder.mockReturnValue({ ilike: mockIlike })
mockIlike.mockResolvedValue({ data: [], error: null })

// Lazy import after mocks are hoisted
const { getListings } = await import('../listings')

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('getListings', () => {
  const SAMPLE_ITEMS = [
    { id: '1', title: 'Power drill', status: 'available', created_at: '2026-04-01T00:00:00Z' },
    { id: '2', title: 'Camping tent', status: 'available', created_at: '2026-04-02T00:00:00Z' },
  ]

  beforeEach(() => {
    vi.clearAllMocks()
    mockSelect.mockReturnValue({ eq: mockEq })
    mockEq.mockReturnValue({ order: mockOrder })
    mockOrder.mockResolvedValue({ data: SAMPLE_ITEMS, error: null })
    mockIlike.mockResolvedValue({ data: SAMPLE_ITEMS, error: null })
  })

  it('returns available items by default when no params given', async () => {
    const result = await getListings({})

    expect(mockEq).toHaveBeenCalledWith('status', 'available')
    expect(mockOrder).toHaveBeenCalledWith('created_at', { ascending: false })
    expect(result).toEqual(SAMPLE_ITEMS)
  })

  it('applies ilike search filter on title when search param is provided', async () => {
    mockEq.mockReturnValue({ order: mockOrder })
    mockOrder.mockReturnValue({ ilike: mockIlike })
    mockIlike.mockResolvedValue({ data: [SAMPLE_ITEMS[0]], error: null })

    const result = await getListings({ search: 'drill' })

    expect(mockIlike).toHaveBeenCalledWith('title', '%drill%')
    expect(result).toHaveLength(1)
  })

  it('trims whitespace from search term before applying filter', async () => {
    mockEq.mockReturnValue({ order: mockOrder })
    mockOrder.mockReturnValue({ ilike: mockIlike })
    mockIlike.mockResolvedValue({ data: [], error: null })

    await getListings({ search: '  tent  ' })

    expect(mockIlike).toHaveBeenCalledWith('title', '%tent%')
  })

  it('returns empty array when Supabase returns an error', async () => {
    mockOrder.mockResolvedValue({ data: null, error: { message: 'DB error' } })

    const result = await getListings({})

    expect(result).toEqual([])
  })

  it('does not apply ilike when search is empty string', async () => {
    await getListings({ search: '' })

    expect(mockIlike).not.toHaveBeenCalled()
  })

  it('does not apply ilike when search is whitespace only', async () => {
    await getListings({ search: '   ' })

    expect(mockIlike).not.toHaveBeenCalled()
  })
})
