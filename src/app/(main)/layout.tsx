// src/app/(main)/layout.tsx
// Layout shell for the authenticated app area.

import Link from 'next/link'
import { MessageSquare, BarChart2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import UserMenu from '@/components/UserMenu'

export default async function MainLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

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
            <Link href="/trades" className="text-gray-600 hover:text-gray-900">
              Trades
            </Link>
            <Link
              href="/listings/new"
              className="rounded-md bg-green-600 px-3 py-1.5 font-medium text-white hover:bg-green-700"
            >
              Post an item
            </Link>
            <Link
              href="/chat"
              className="flex items-center gap-1.5 rounded-md border border-gray-300 bg-white px-3 py-1.5 font-medium text-gray-700 hover:bg-gray-50 transition-colors"
            >
              <MessageSquare className="h-4 w-4" />
              Chat
            </Link>
            <Link
              href="/dev"
              className="flex items-center gap-1.5 rounded-md border border-gray-300 bg-white px-3 py-1.5 font-medium text-gray-700 hover:bg-gray-50 transition-colors"
            >
              <BarChart2 className="h-4 w-4" />
              Dev
            </Link>
            {user && <UserMenu email={user.email ?? ''} />}
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-4xl px-4 py-8">{children}</main>
    </div>
  )
}
