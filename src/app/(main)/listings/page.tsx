// src/app/(main)/listings/page.tsx
// Marketplace feed — server component with URL-param driven search.

import type { Metadata } from 'next'
import Link from 'next/link'
import { Suspense } from 'react'
import { CalendarDays, Package } from 'lucide-react'
import { getListings } from '@/lib/listings'
import SearchBar from '@/components/listings/SearchBar'
import type { Listing } from '@/types/listings'

export const metadata: Metadata = {
  title: 'Browse Items — NeighborSwap',
}

interface PageProps {
  searchParams: { q?: string }
}

export default async function ListingsPage({ searchParams }: PageProps) {
  const items: Listing[] = await getListings({ search: searchParams.q })

  return (
    <>
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Available items</h1>
        <Link
          href="/listings/new"
          className="rounded-md bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700"
        >
          Post an item
        </Link>
      </div>

      {/* SearchBar uses useSearchParams — must be wrapped in Suspense */}
      <Suspense fallback={null}>
        <SearchBar defaultSearch={searchParams.q} />
      </Suspense>

      {items.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-300 bg-white py-16 text-center">
          <Package className="mx-auto mb-3 h-10 w-10 text-gray-300" />
          <p className="text-sm font-medium text-gray-500">
            {searchParams.q ? `No items matched "${searchParams.q}".` : 'No items yet.'}
          </p>
          <p className="mt-1 text-xs text-gray-400">
            {searchParams.q ? 'Try a different search term.' : 'Be the first to post something!'}
          </p>
        </div>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((item) => (
            <li key={item.id}>
              <Link
                href={`/listings/${item.id}`}
                className="block overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm transition hover:shadow-md"
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
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  )
}
