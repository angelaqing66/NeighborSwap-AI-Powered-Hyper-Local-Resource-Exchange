// src/components/chat/__tests__/TradeStatusPanel.test.ts
// Unit tests for getAvailableTransitions — the pure transition-filter logic
// extracted from TradeStatusPanel. No DOM rendering required.

import { describe, it, expect } from 'vitest'
import { getAvailableTransitions } from '../TradeStatusPanel'

describe('getAvailableTransitions', () => {
  // ── pending_offer ──────────────────────────────────────────────────────────

  it('pending_offer: counterparty can start negotiating or cancel', () => {
    const transitions = getAvailableTransitions('pending_offer', false, true)
    const nexts = transitions.map((t) => t.next)
    expect(nexts).toContain('negotiating')
    expect(nexts).toContain('cancelled')
  })

  it('pending_offer: initiator can only cancel (not start negotiating)', () => {
    const transitions = getAvailableTransitions('pending_offer', true, false)
    const nexts = transitions.map((t) => t.next)
    expect(nexts).not.toContain('negotiating')
    expect(nexts).toContain('cancelled')
  })

  it('pending_offer: negotiating transition is not flagged as danger', () => {
    const transitions = getAvailableTransitions('pending_offer', false, true)
    const negotiate = transitions.find((t) => t.next === 'negotiating')
    expect(negotiate?.danger).toBe(false)
  })

  it('pending_offer: cancel transition is flagged as danger', () => {
    const transitions = getAvailableTransitions('pending_offer', false, true)
    const cancel = transitions.find((t) => t.next === 'cancelled')
    expect(cancel?.danger).toBe(true)
  })

  // ── negotiating ────────────────────────────────────────────────────────────

  it('negotiating: both parties can accept or cancel', () => {
    const asInitiator = getAvailableTransitions('negotiating', true, false)
    const asCounterparty = getAvailableTransitions('negotiating', false, true)
    expect(asInitiator.map((t) => t.next)).toContain('accepted')
    expect(asCounterparty.map((t) => t.next)).toContain('accepted')
    expect(asInitiator.map((t) => t.next)).toContain('cancelled')
    expect(asCounterparty.map((t) => t.next)).toContain('cancelled')
  })

  // ── accepted ───────────────────────────────────────────────────────────────

  it('accepted: both parties can mark in_progress or dispute', () => {
    const transitions = getAvailableTransitions('accepted', true, false)
    const nexts = transitions.map((t) => t.next)
    expect(nexts).toContain('in_progress')
    expect(nexts).toContain('disputed')
  })

  // ── in_progress ────────────────────────────────────────────────────────────

  it('in_progress: both parties can complete or dispute', () => {
    const transitions = getAvailableTransitions('in_progress', true, false)
    const nexts = transitions.map((t) => t.next)
    expect(nexts).toContain('completed')
    expect(nexts).toContain('disputed')
  })

  it('in_progress: complete is not danger, dispute is danger', () => {
    const transitions = getAvailableTransitions('in_progress', true, false)
    const complete = transitions.find((t) => t.next === 'completed')
    const dispute = transitions.find((t) => t.next === 'disputed')
    expect(complete?.danger).toBe(false)
    expect(dispute?.danger).toBe(true)
  })

  // ── terminal statuses ──────────────────────────────────────────────────────

  it('completed: no transitions available', () => {
    expect(getAvailableTransitions('completed', true, false)).toHaveLength(0)
  })

  it('cancelled: no transitions available', () => {
    expect(getAvailableTransitions('cancelled', true, true)).toHaveLength(0)
  })

  it('flagged: no transitions available', () => {
    expect(getAvailableTransitions('flagged', true, true)).toHaveLength(0)
  })

  it('disputed: no transitions available', () => {
    expect(getAvailableTransitions('disputed', false, true)).toHaveLength(0)
  })

  // ── non-party ──────────────────────────────────────────────────────────────

  it('returns no transitions when user is neither initiator nor counterparty', () => {
    expect(getAvailableTransitions('negotiating', false, false)).toHaveLength(0)
  })
})
