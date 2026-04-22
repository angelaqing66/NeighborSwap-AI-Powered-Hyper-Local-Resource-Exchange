// src/lib/__tests__/getDevStats.test.ts
// Unit tests for developer dashboard stat utilities.

import { describe, it, expect } from 'vitest'
import { computeStatusBreakdown, computeActiveCount, ACTIVE_STATUSES } from '../getDevStats'

// ── computeStatusBreakdown ────────────────────────────────────────────────────

describe('computeStatusBreakdown', () => {
  it('returns an empty record for an empty array', () => {
    expect(computeStatusBreakdown([])).toEqual({})
  })

  it('counts a single status correctly', () => {
    const trades = [{ status: 'pending_offer' }]
    expect(computeStatusBreakdown(trades)).toEqual({ pending_offer: 1 })
  })

  it('counts multiple statuses correctly', () => {
    const trades = [
      { status: 'pending_offer' },
      { status: 'negotiating' },
      { status: 'pending_offer' },
      { status: 'completed' },
    ]
    expect(computeStatusBreakdown(trades)).toEqual({
      pending_offer: 2,
      negotiating: 1,
      completed: 1,
    })
  })

  it('handles all nine known trade statuses', () => {
    const statuses = [
      'pending_offer',
      'negotiating',
      'accepted',
      'scheduled',
      'in_progress',
      'completed',
      'cancelled',
      'disputed',
      'flagged',
    ]
    const trades = statuses.map((status) => ({ status }))
    const result = computeStatusBreakdown(trades)

    for (const status of statuses) {
      expect(result[status]).toBe(1)
    }
  })

  it('handles an unknown / future status gracefully', () => {
    const trades = [{ status: 'unknown_future_status' }]
    expect(computeStatusBreakdown(trades)).toEqual({ unknown_future_status: 1 })
  })

  it('counts large arrays efficiently', () => {
    const trades = Array.from({ length: 1000 }, (_, i) => ({
      status: i % 2 === 0 ? 'completed' : 'cancelled',
    }))
    const result = computeStatusBreakdown(trades)
    expect(result['completed']).toBe(500)
    expect(result['cancelled']).toBe(500)
  })
})

// ── computeActiveCount ────────────────────────────────────────────────────────

describe('computeActiveCount', () => {
  it('returns 0 for an empty breakdown', () => {
    expect(computeActiveCount({})).toBe(0)
  })

  it('returns 0 when only terminal statuses are present', () => {
    const breakdown = { completed: 10, cancelled: 5, disputed: 2, flagged: 1 }
    expect(computeActiveCount(breakdown)).toBe(0)
  })

  it('sums accepted, scheduled, and in_progress', () => {
    const breakdown = {
      accepted: 3,
      scheduled: 7,
      in_progress: 2,
      completed: 100,
      cancelled: 4,
    }
    expect(computeActiveCount(breakdown)).toBe(12)
  })

  it('handles missing active statuses gracefully (treats as 0)', () => {
    const breakdown = { accepted: 5 }
    expect(computeActiveCount(breakdown)).toBe(5)
  })

  it('returns 0 when all active status counts are 0 (absent from breakdown)', () => {
    const breakdown = { pending_offer: 3, negotiating: 1 }
    expect(computeActiveCount(breakdown)).toBe(0)
  })

  it('counts only the three active statuses defined in ACTIVE_STATUSES', () => {
    // Verify the exported constant itself
    expect(ACTIVE_STATUSES).toContain('accepted')
    expect(ACTIVE_STATUSES).toContain('scheduled')
    expect(ACTIVE_STATUSES).toContain('in_progress')
    expect(ACTIVE_STATUSES).not.toContain('completed')
    expect(ACTIVE_STATUSES).not.toContain('cancelled')
    expect(ACTIVE_STATUSES).not.toContain('pending_offer')
    expect(ACTIVE_STATUSES).not.toContain('negotiating')
    expect(ACTIVE_STATUSES).not.toContain('disputed')
    expect(ACTIVE_STATUSES).not.toContain('flagged')
  })
})

// ── Integration: breakdown → active count pipeline ───────────────────────────

describe('computeStatusBreakdown → computeActiveCount pipeline', () => {
  it('computes correct active count from raw trade array', () => {
    const trades = [
      { status: 'pending_offer' },
      { status: 'pending_offer' },
      { status: 'accepted' },
      { status: 'scheduled' },
      { status: 'in_progress' },
      { status: 'in_progress' },
      { status: 'completed' },
      { status: 'completed' },
      { status: 'completed' },
      { status: 'cancelled' },
    ]
    const breakdown = computeStatusBreakdown(trades)
    const active = computeActiveCount(breakdown)

    // accepted(1) + scheduled(1) + in_progress(2) = 4
    expect(active).toBe(4)
  })

  it('returns 0 active count when all trades are terminal', () => {
    const trades = [
      { status: 'completed' },
      { status: 'completed' },
      { status: 'cancelled' },
      { status: 'disputed' },
      { status: 'flagged' },
    ]
    const breakdown = computeStatusBreakdown(trades)
    expect(computeActiveCount(breakdown)).toBe(0)
  })
})
