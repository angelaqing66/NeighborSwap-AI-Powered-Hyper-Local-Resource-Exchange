// src/components/chat/__tests__/TradeStatusPanel.test.ts
// Unit tests for getAvailableTransitions — the pure transition-filter logic
// extracted from TradeStatusPanel. No DOM rendering required.

import { describe, it, expect } from 'vitest'
import { getAvailableTransitions } from '../TradeStatusPanel'

describe('getAvailableTransitions', () => {
  // ── pending_offer ──────────────────────────────────────────────────────────

  it('pending_offer: counterparty can accept or decline the request', () => {
    const nexts = getAvailableTransitions('pending_offer', false, true).map((t) => t.next)
    expect(nexts).toContain('accepted')
    expect(nexts).toContain('cancelled')
  })

  it('pending_offer: counterparty does not see negotiating (legacy step hidden)', () => {
    const nexts = getAvailableTransitions('pending_offer', false, true).map((t) => t.next)
    expect(nexts).not.toContain('negotiating')
  })

  it('pending_offer: initiator can only withdraw (not accept)', () => {
    const nexts = getAvailableTransitions('pending_offer', true, false).map((t) => t.next)
    expect(nexts).not.toContain('accepted')
    expect(nexts).not.toContain('negotiating')
    expect(nexts).toContain('cancelled')
  })

  it('pending_offer: Accept Request button is labeled "Accept Request"', () => {
    const t = getAvailableTransitions('pending_offer', false, true).find(
      (x) => x.next === 'accepted'
    )
    expect(t?.label).toBe('Accept Request')
  })

  it('pending_offer: Accept Request is not a danger action', () => {
    const t = getAvailableTransitions('pending_offer', false, true).find(
      (x) => x.next === 'accepted'
    )
    expect(t?.danger).toBe(false)
  })

  it('pending_offer: Accept Request requires confirmation', () => {
    const t = getAvailableTransitions('pending_offer', false, true).find(
      (x) => x.next === 'accepted'
    )
    expect(t?.requiresConfirmation).toBe(true)
  })

  it('pending_offer: counterparty cancel is labeled "Decline"', () => {
    const t = getAvailableTransitions('pending_offer', false, true).find(
      (x) => x.next === 'cancelled'
    )
    expect(t?.label).toBe('Decline')
  })

  it('pending_offer: initiator cancel is labeled "Withdraw Request"', () => {
    const t = getAvailableTransitions('pending_offer', true, false).find(
      (x) => x.next === 'cancelled'
    )
    expect(t?.label).toBe('Withdraw Request')
  })

  it('pending_offer: Decline is a danger action that requires confirmation and a reason', () => {
    const t = getAvailableTransitions('pending_offer', false, true).find(
      (x) => x.next === 'cancelled'
    )
    expect(t?.danger).toBe(true)
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

  it('accepted: initiator (borrower) can confirm pickup and dispute', () => {
    const nexts = getAvailableTransitions('accepted', true, false).map((t) => t.next)
    expect(nexts).toContain('in_progress')
    expect(nexts).toContain('disputed')
  })

  it('accepted: counterparty (lender) cannot confirm pickup', () => {
    const nexts = getAvailableTransitions('accepted', false, true).map((t) => t.next)
    expect(nexts).not.toContain('in_progress')
  })

  it('accepted: counterparty (lender) can still dispute', () => {
    const nexts = getAvailableTransitions('accepted', false, true).map((t) => t.next)
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

  it('accepted: both parties can cancel before pickup', () => {
    const initiatorNexts = getAvailableTransitions('accepted', true, false).map((t) => t.next)
    const counterpartyNexts = getAvailableTransitions('accepted', false, true).map((t) => t.next)
    expect(initiatorNexts).toContain('cancelled')
    expect(counterpartyNexts).toContain('cancelled')
  })

  it('accepted: cancel is a danger action requiring confirmation and a reason', () => {
    const t = getAvailableTransitions('accepted', true, false).find((x) => x.next === 'cancelled')
    expect(t?.danger).toBe(true)
    expect(t?.requiresConfirmation).toBe(true)
    expect(t?.requiresReason).toBe(true)
  })

  // ── scheduled ─────────────────────────────────────────────────────────────

  it('scheduled: initiator (borrower) can confirm pickup', () => {
    const nexts = getAvailableTransitions('scheduled', true, false).map((t) => t.next)
    expect(nexts).toContain('in_progress')
  })

  it('scheduled: counterparty (lender) cannot confirm pickup', () => {
    const nexts = getAvailableTransitions('scheduled', false, true).map((t) => t.next)
    expect(nexts).not.toContain('in_progress')
  })

  it('scheduled: confirm pickup requires confirmation', () => {
    const t = getAvailableTransitions('scheduled', true, false).find(
      (x) => x.next === 'in_progress'
    )
    expect(t?.requiresConfirmation).toBe(true)
  })

  // ── in_progress ────────────────────────────────────────────────────────────

  it('in_progress: counterparty (lender) can confirm return', () => {
    const nexts = getAvailableTransitions('in_progress', false, true).map((t) => t.next)
    expect(nexts).toContain('completed')
  })

  it('in_progress: initiator (borrower) cannot confirm return', () => {
    const nexts = getAvailableTransitions('in_progress', true, false).map((t) => t.next)
    expect(nexts).not.toContain('completed')
  })

  it('in_progress: both parties can dispute', () => {
    const asInitiator = getAvailableTransitions('in_progress', true, false).map((t) => t.next)
    const asCounterparty = getAvailableTransitions('in_progress', false, true).map((t) => t.next)
    expect(asInitiator).toContain('disputed')
    expect(asCounterparty).toContain('disputed')
  })

  it('in_progress: confirm return button is labeled "Confirm Return"', () => {
    const t = getAvailableTransitions('in_progress', false, true).find(
      (x) => x.next === 'completed'
    )
    expect(t?.label).toBe('Confirm Return')
  })

  it('in_progress: confirm return requires confirmation (possession transfer)', () => {
    const t = getAvailableTransitions('in_progress', false, true).find(
      (x) => x.next === 'completed'
    )
    expect(t?.requiresConfirmation).toBe(true)
  })

  it('in_progress: confirm return is not a danger action', () => {
    const t = getAvailableTransitions('in_progress', false, true).find(
      (x) => x.next === 'completed'
    )
    expect(t?.danger).toBe(false)
  })

  it('in_progress: confirm return does not require a reason', () => {
    const t = getAvailableTransitions('in_progress', false, true).find(
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
