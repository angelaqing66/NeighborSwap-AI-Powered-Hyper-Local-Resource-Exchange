'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import type { TradeSidebarItem } from '@/app/(main)/chat/layout'

const STATUS_LABELS: Record<string, string> = {
  pending_offer: 'Pending offer',
  negotiating: 'Negotiating',
  accepted: 'Accepted',
  flagged: 'Flagged',
  scheduled: 'Scheduled',
  in_progress: 'In progress',
  completed: 'Completed',
  cancelled: 'Cancelled',
  disputed: 'Disputed',
}

export default function TradeSidebar({ trades }: { trades: TradeSidebarItem[] }) {
  const pathname = usePathname()

  if (trades.length === 0) {
    return (
      <p className="p-4 text-xs text-gray-400">
        No active trades.{' '}
        <Link href="/listings" className="text-green-600 underline">
          Browse listings
        </Link>{' '}
        to get started.
      </p>
    )
  }

  return (
    <ul className="divide-y divide-gray-100">
      {trades.map((trade) => {
        const href = `/chat/${trade.id}`
        const isActive = pathname === href
        return (
          <li key={trade.id}>
            <Link
              href={href}
              className={`block px-4 py-3 transition-colors hover:bg-gray-50 ${
                isActive ? 'border-r-2 border-green-600 bg-green-50' : ''
              }`}
            >
              <p
                className={`truncate text-sm font-medium ${
                  isActive ? 'text-green-700' : 'text-gray-800'
                }`}
              >
                {trade.item_title ?? `#${trade.id.slice(0, 8).toUpperCase()}`}
              </p>
              <p className="mt-0.5 text-xs text-gray-400">
                {STATUS_LABELS[trade.status] ?? trade.status}
              </p>
            </Link>
          </li>
        )
      })}
    </ul>
  )
}
