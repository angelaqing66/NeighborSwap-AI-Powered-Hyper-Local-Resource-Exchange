// src/lib/getDevStats.ts
// Pure utility functions for the developer dashboard.
// No DB access — these operate on data already fetched by the page.

import type { TradeStatus } from '@/types/trades'

/** Active statuses — trades that are in motion but not yet terminal. */
export const ACTIVE_STATUSES: readonly TradeStatus[] = ['accepted', 'scheduled', 'in_progress']

/**
 * Count how many trades belong to each status.
 *
 * @param trades - Array of objects that have a `status` string field.
 * @returns A record mapping status string → count.
 */
export function computeStatusBreakdown(trades: { status: string }[]): Record<string, number> {
  const breakdown: Record<string, number> = {}
  for (const trade of trades) {
    breakdown[trade.status] = (breakdown[trade.status] ?? 0) + 1
  }
  return breakdown
}

/**
 * Sum the counts for the three active statuses.
 *
 * @param breakdown - Output of `computeStatusBreakdown`.
 * @returns Total number of active trades.
 */
export function computeActiveCount(breakdown: Record<string, number>): number {
  return ACTIVE_STATUSES.reduce((sum, status) => sum + (breakdown[status] ?? 0), 0)
}
