// src/components/chat/__tests__/TradeStatusPanel.test.ts
// Unit tests for getAvailableTransitions — the pure transition-filter logic
// extracted from TradeStatusPanel. No DOM rendering required.

import { describe, it, expect } from 'vitest'
import { getAvailableTransitions } from '../TradeStatusPanel'

describe('getAvailableTransitions', () => {
  // ── pending_offer ──────────────────────────────────────────────────────────

  it('pending_offer: counterparty can start inquiry or cancel', () => {
    const nexts = getAvailableTransitions('pending_offer', false, true).map((t) => t.next)
    expect(nexts).toContain('negotiating')
    expect(nexts).toContain('cancelled')
  })

  it('pending_offer: initiator can only cancel (not start inquiry)', () => {
    const nexts = getAvailableTransitions('pending_offer', true, false).map((t) => t.next)
    expect(nexts).not.toContain('negotiating')
    expect(nexts).toContain('cancelled')
  })

  it('pending_offer: start inquiry button is labeled "Start Inquiry"', () => {
    const t = getAvailableTransitions('pending_offer', false, true).find(
      (x) => x.next === 'negotiating'
    )
    expect(t?.label).toBe('Start Inquiry')
  })

  it('pending_offer: start inquiry is not a danger action', () => {
    const t = getAvailableTransitions('pending_offer', false, true).find(
      (x) => x.next === 'negotiating'
    )
    expect(t?.danger).toBe(false)
  })

  it('pending_offer: start inquiry does not require confirmation', () => {
    const t = getAvailableTransitions('pending_offer', false, true).find(
      (x) => x.next === 'negotiating'
    )
    expect(t?.requiresConfirmation).toBe(false)
  })

  it('pending_offer: cancel is a danger action', () => {
    const t = getAvailableTransitions('pending_offer', false, true).find(
      (x) => x.next === 'cancelled'
    )
    expect(t?.danger).toBe(true)
  })

  it('pending_offer: cancel requires confirmation and a reason', () => {
    const t = getAvailableTransitions('pending_offer', false, true).find(
      (x) => x.next === 'cancelled'
    )
    expect(t?.requiresConfirmation).toBe(true)
    expect(t?.requiresReason).toBe(true)
  })

  // ── negotiating ────────────────────────────────────────────────────────────

  it('negotiating: both parties can request swap or cancel', () => {
    const asInitiator = getAvailableTransitions('negotiating', true, false).map((t) => t.next)
    const asCounterparty = getAvailableTransitions('negotiating', false, true).map((t) => t.next)
    expect(asInitiator).toContain('accepted')
    expect(asCounterparty).toContain('accepted')
    expect(asInitiator).toContain('cancelled')
    expect(asCounterparty).toContain('cancelled')
  })

  it('negotiating: request swap button is labeled "Request Swap"', () => {
    const t = getAvailableTransitions('negotiating', true, false).find((x) => x.next === 'accepted')
    expect(t?.label).toBe('Request Swap')
  })

  it('negotiating: request swap does not require confirmation', () => {
    const t = getAvailableTransitions('negotiating', true, false).find((x) => x.next === 'accepted')
    expect(t?.requiresConfirmation).toBe(false)
  })

  // ── accepted ───────────────────────────────────────────────────────────────

  it('accepted: both parties can confirm pickup or dispute', () => {
    const nexts = getAvailableTransitions('accepted', true, false).map((t) => t.next)
    expect(nexts).toContain('in_progress')
    expect(nexts).toContain('disputed')
  })

  it('accepted: confirm pickup button is labeled "Confirm Pickup"', () => {
    const t = getAvailableTransitions('accepted', true, false).find((x) => x.next === 'in_progress')
    expect(t?.label).toBe('Confirm Pickup')
  })

  it('accepted: confirm pickup requires confirmation (possession transfer)', () => {
    const t = getAvailableTransitions('accepted', true, false).find((x) => x.next === 'in_progress')
    expect(t?.requiresConfirmation).toBe(true)
  })

  it('accepted: confirm pickup is not a danger action', () => {
    const t = getAvailableTransitions('accepted', true, false).find((x) => x.next === 'in_progress')
    expect(t?.danger).toBe(false)
  })

  it('accepted: dispute is a danger action that requires confirmation and a reason', () => {
    const t = getAvailableTransitions('accepted', true, false).find((x) => x.next === 'disputed')
    expect(t?.danger).toBe(true)
    expect(t?.requiresConfirmation).toBe(true)
    expect(t?.requiresReason).toBe(true)
  })

  it('accepted: confirm pickup does not require a reason', () => {
    const t = getAvailableTransitions('accepted', true, false).find((x) => x.next === 'in_progress')
    expect(t?.requiresReason).toBe(false)
  })

  // ── scheduled ─────────────────────────────────────────────────────────────

  it('scheduled: both parties can confirm pickup', () => {
    const nexts = getAvailableTransitions('scheduled', true, false).map((t) => t.next)
    expect(nexts).toContain('in_progress')
  })

  it('scheduled: confirm pickup requires confirmation', () => {
    const t = getAvailableTransitions('scheduled', true, false).find(
      (x) => x.next === 'in_progress'
    )
    expect(t?.requiresConfirmation).toBe(true)
  })

  // ── in_progress ────────────────────────────────────────────────────────────

  it('in_progress: both parties can confirm return or dispute', () => {
    const nexts = getAvailableTransitions('in_progress', true, false).map((t) => t.next)
    expect(nexts).toContain('completed')
    expect(nexts).toContain('disputed')
  })

  it('in_progress: confirm return button is labeled "Confirm Return"', () => {
    const t = getAvailableTransitions('in_progress', true, false).find(
      (x) => x.next === 'completed'
    )
    expect(t?.label).toBe('Confirm Return')
  })

  it('in_progress: confirm return requires confirmation (possession transfer)', () => {
    const t = getAvailableTransitions('in_progress', true, false).find(
      (x) => x.next === 'completed'
    )
    expect(t?.requiresConfirmation).toBe(true)
  })

  it('in_progress: confirm return is not a danger action', () => {
    const t = getAvailableTransitions('in_progress', true, false).find(
      (x) => x.next === 'completed'
    )
    expect(t?.danger).toBe(false)
  })

  it('in_progress: confirm return does not require a reason', () => {
    const t = getAvailableTransitions('in_progress', true, false).find(
      (x) => x.next === 'completed'
    )
    expect(t?.requiresReason).toBe(false)
  })

  it('in_progress: dispute requires confirmation and a reason', () => {
    const t = getAvailableTransitions('in_progress', true, false).find((x) => x.next === 'disputed')
    expect(t?.requiresConfirmation).toBe(true)
    expect(t?.requiresReason).toBe(true)
  })

  it('negotiating: cancel requires confirmation and a reason', () => {
    const t = getAvailableTransitions('negotiating', true, false).find(
      (x) => x.next === 'cancelled'
    )
    expect(t?.requiresConfirmation).toBe(true)
    expect(t?.requiresReason).toBe(true)
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
