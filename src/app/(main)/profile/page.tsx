// src/app/(main)/profile/page.tsx
// User profile page — displays trust score, vibe badge, and account details.

import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { User, ShieldCheck, Star, CalendarDays } from 'lucide-react'
import type { UserProfile } from '@/types/user'

export const metadata: Metadata = {
  title: 'My Profile — NeighborSwap',
}

function TrustBadge({ score }: { score: number }) {
  if (score >= 80) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-green-50 px-3 py-1 text-sm font-medium text-green-700">
        <ShieldCheck className="h-4 w-4" aria-hidden />
        Trusted neighbor
      </span>
    )
  }
  if (score >= 60) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-3 py-1 text-sm font-medium text-blue-700">
        <Star className="h-4 w-4" aria-hidden />
        Established
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-gray-100 px-3 py-1 text-sm font-medium text-gray-600">
      <User className="h-4 w-4" aria-hidden />
      New member
    </span>
  )
}

function TrustScoreBar({ score }: { score: number }) {
  const pct = Math.min(Math.max(score, 0), 100)
  const color = pct >= 80 ? 'bg-green-500' : pct >= 60 ? 'bg-blue-500' : 'bg-gray-400'

  return (
    <div className="mt-2">
      <div className="flex items-center justify-between text-xs text-gray-500">
        <span>Trust score</span>
        <span className="font-semibold text-gray-700">{pct}/100</span>
      </div>
      <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-gray-100">
        <div
          className={`h-2 rounded-full transition-all ${color}`}
          style={{ width: `${pct}%` }}
          role="progressbar"
          aria-valuenow={pct}
          aria-valuemin={0}
          aria-valuemax={100}
        />
      </div>
    </div>
  )
}

export default async function ProfilePage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('users').select('*').eq('id', user.id).single()

  const userProfile = profile as UserProfile | null

  const memberSince = user.created_at
    ? new Date(user.created_at).toLocaleDateString(undefined, {
        month: 'long',
        year: 'numeric',
      })
    : null

  // Fetch trade stats
  const { count: completedCount } = await supabase
    .from('trades')
    .select('id', { count: 'exact', head: true })
    .or(`initiator_id.eq.${user.id},counterparty_id.eq.${user.id}`)
    .eq('status', 'completed')

  const { count: activeCount } = await supabase
    .from('trades')
    .select('id', { count: 'exact', head: true })
    .or(`initiator_id.eq.${user.id},counterparty_id.eq.${user.id}`)
    .not('status', 'in', '("completed","cancelled","disputed","flagged")')

  const trustScore = userProfile?.trust_score ?? 50

  return (
    <div className="mx-auto max-w-lg">
      <h1 className="mb-6 text-2xl font-bold text-gray-900">My profile</h1>

      {/* Identity card */}
      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <div className="flex items-start gap-4">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-green-100">
            <User className="h-7 w-7 text-green-600" aria-hidden />
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-lg font-semibold text-gray-900">
              {userProfile?.full_name ?? user.email ?? 'Neighbor'}
            </p>
            <p className="truncate text-sm text-gray-500">{user.email}</p>
            <div className="mt-2">
              <TrustBadge score={trustScore} />
            </div>
          </div>
        </div>

        <div className="mt-6 border-t border-gray-100 pt-4">
          <TrustScoreBar score={trustScore} />
          <p className="mt-1.5 text-xs text-gray-400">
            Trust score is updated by the AI vibe agent after each completed trade.
          </p>
        </div>

        {memberSince && (
          <div className="mt-4 flex items-center gap-1.5 text-xs text-gray-400">
            <CalendarDays className="h-3.5 w-3.5" aria-hidden />
            <span>Member since {memberSince}</span>
          </div>
        )}
      </div>

      {/* Trade stats */}
      <div className="mt-4 grid grid-cols-2 gap-3">
        <div className="rounded-xl border border-gray-200 bg-white p-4 text-center shadow-sm">
          <p className="text-2xl font-bold text-gray-900">{completedCount ?? 0}</p>
          <p className="mt-0.5 text-xs text-gray-500">Completed trades</p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-4 text-center shadow-sm">
          <p className="text-2xl font-bold text-indigo-600">{activeCount ?? 0}</p>
          <p className="mt-0.5 text-xs text-gray-500">Active trades</p>
        </div>
      </div>
    </div>
  )
}
