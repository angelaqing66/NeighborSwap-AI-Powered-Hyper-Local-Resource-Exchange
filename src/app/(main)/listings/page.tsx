// src/app/(main)/listings/page.tsx
// Browse page — server component that fetches all available listings.

import type { Metadata } from 'next'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { CalendarDays, Package } from 'lucide-react'
import type { Listing } from '@/types/listings'

export const metadata: Metadata = {
  title: 'Browse Items — NeighborSwap',
}

export default async function ListingsPage() {
  const supabase = await createClient()

  const { data: listings, error } = await supabase
    .from('items')
    .select('*')
    .eq('status', 'available')
    .order('created_at', { ascending: false })

  if (error) {
    return <p className="text-sm text-red-600">Could not load listings. Please try again later.</p>
  }

  const items = (listings ?? []) as Listing[]

  return (
    <>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Available items</h1>
        <Link
          href="/listings/new"
          className="rounded-md bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700"
        >
          Post an item
        </Link>
      </div>

      {items.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-300 bg-white py-16 text-center">
          <Package className="mx-auto mb-3 h-10 w-10 text-gray-300" />
          <p className="text-sm font-medium text-gray-500">No items yet.</p>
          <p className="mt-1 text-xs text-gray-400">Be the first to post something!</p>
        </div>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((item) => (
            <li
              key={item.id}
              className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm"
            >
              {item.image_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={item.image_url} alt={item.title} className="h-40 w-full object-cover" />
              ) : (
                <div className="flex h-40 items-center justify-center bg-gray-100">
                  <Package className="h-10 w-10 text-gray-300" />
                </div>
              )}

              <div className="p-4">
                <h2 className="truncate text-sm font-semibold text-gray-900">{item.title}</h2>
                <p className="mt-1 line-clamp-2 text-xs text-gray-500">{item.description}</p>

                {item.return_by_date && (
                  <div className="mt-2 flex items-center gap-1 text-xs text-gray-400">
                    <CalendarDays className="h-3.5 w-3.5" aria-hidden />
                    <span>
                      Return by{' '}
                      {new Date(item.return_by_date + 'T00:00:00').toLocaleDateString(undefined, {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                      })}
                    </span>
                  </div>
                )}

                {item.borrowing_rules && (
                  <p className="mt-2 line-clamp-2 text-xs italic text-gray-400">
                    {item.borrowing_rules}
                  </p>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </>
  )
}
