// src/app/(main)/layout.tsx
// Layout shell for the authenticated app area.

import Link from 'next/link'

export default function MainLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gray-50">
      <header className="border-b border-gray-200 bg-white">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-3">
          <Link href="/" className="text-lg font-bold tracking-tight text-gray-900">
            NeighborSwap
          </Link>
          <nav className="flex items-center gap-4 text-sm">
            <Link href="/listings" className="text-gray-600 hover:text-gray-900">
              Browse
            </Link>
            <Link
              href="/listings/new"
              className="rounded-md bg-green-600 px-3 py-1.5 font-medium text-white hover:bg-green-700"
            >
              Post an item
            </Link>
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-4xl px-4 py-8">{children}</main>
    </div>
  )
}
