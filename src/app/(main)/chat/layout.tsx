// src/app/(main)/chat/layout.tsx
// Two-column chat shell: trade sidebar + chat panel.

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { MessageSquare } from 'lucide-react'
import TradeSidebar from '@/components/chat/TradeSidebar'
import type { Trade } from '@/types/trades'

export default async function ChatLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: trades } = await supabase
    .from('trades')
    .select('id, status')
    .or(`initiator_id.eq.${user.id},counterparty_id.eq.${user.id}`)
    .not('status', 'in', '("completed","cancelled")')
    .order('updated_at', { ascending: false })
    .limit(30)

  const tradeList = (trades ?? []) as Pick<Trade, 'id' | 'status'>[]

  return (
    <div className="flex h-[calc(100vh-8rem)] overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
      {/* Sidebar */}
      <aside className="flex w-64 flex-shrink-0 flex-col border-r border-gray-200">
        <div className="flex items-center gap-2 border-b border-gray-100 px-4 py-3">
          <MessageSquare className="h-4 w-4 text-gray-500" />
          <h2 className="text-sm font-semibold text-gray-700">Active trades</h2>
        </div>
        <div className="flex-1 overflow-y-auto">
          <TradeSidebar trades={tradeList} />
        </div>
      </aside>

      {/* Chat panel */}
      <div className="flex min-w-0 flex-1 flex-col">{children}</div>
    </div>
  )
}
