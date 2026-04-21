// src/app/(main)/listings/[id]/page.tsx
// Item detail page — shows full listing info and Request Swap action.

import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { CalendarDays, Package, ChevronLeft, ShieldCheck } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import RequestSwapButton from '@/components/listings/RequestSwapButton'
import type { Listing } from '@/types/listings'
import type { UserProfile } from '@/types/user'

interface Props {
  params: Promise<{ id: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params
  const supabase = await createClient()
  const { data } = await supabase.from('items').select('title').eq('id', id).single()
  return { title: data ? `${data.title} — NeighborSwap` : 'Item not found — NeighborSwap' }
}

export default async function ItemDetailPage({ params }: Props) {
  const { id } = await params
  const supabase = await createClient()

  const [
    { data: itemData },
    {
      data: { user },
    },
  ] = await Promise.all([
    supabase.from('items').select('*').eq('id', id).single(),
    supabase.auth.getUser(),
  ])

  if (!itemData) notFound()

  const item = itemData as Listing

  const [{ data: providerData }, { data: activeTradeData }] = await Promise.all([
    supabase
      .from('users')
      .select('id, full_name, avatar_url, trust_score')
      .eq('id', item.provider_id)
      .single(),
    supabase
      .from('trades')
      .select('id')
      .eq('item_id', id)
      .eq('status', 'in_progress')
      .limit(1)
      .maybeSingle(),
  ])

  const isLocked = !!activeTradeData

  const provider = providerData as Pick<
    UserProfile,
    'id' | 'full_name' | 'avatar_url' | 'trust_score'
  > | null

  const isOwner = user?.id === item.provider_id

  const initials = provider?.full_name
    ? provider.full_name
        .split(' ')
        .map((n) => n[0])
        .join('')
        .slice(0, 2)
        .toUpperCase()
    : '?'

  return (
    <div className="mx-auto max-w-2xl">
      {/* Back link */}
      <Link
        href="/listings"
        className="mb-4 inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-800"
      >
        <ChevronLeft className="h-4 w-4" aria-hidden />
        Available items
      </Link>

      {/* Image */}
      {item.image_url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={item.image_url}
          alt={item.title}
          className="mb-6 h-64 w-full rounded-xl object-cover"
        />
      ) : (
        <div className="mb-6 flex h-64 w-full items-center justify-center rounded-xl bg-gray-100">
          <Package className="h-16 w-16 text-gray-300" />
        </div>
      )}

      {/* Title */}
      <h1 className="text-2xl font-bold text-gray-900">{item.title}</h1>

      {/* Meta row */}
      <div className="mt-2 flex flex-wrap gap-3">
        {item.return_by_date && (
          <span className="inline-flex items-center gap-1 text-xs text-gray-500">
            <CalendarDays className="h-3.5 w-3.5" aria-hidden />
            Return by{' '}
            {new Date(item.return_by_date + 'T00:00:00').toLocaleDateString(undefined, {
              month: 'short',
              day: 'numeric',
              year: 'numeric',
            })}
          </span>
        )}
      </div>

      {/* Description */}
      <p className="mt-4 whitespace-pre-wrap text-sm leading-relaxed text-gray-700">
        {item.description}
      </p>

      {/* Borrowing rules */}
      {item.borrowing_rules && (
        <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3">
          <p className="text-xs font-semibold text-amber-700">Borrowing rules</p>
          <p className="mt-1 text-sm text-amber-900">{item.borrowing_rules}</p>
        </div>
      )}

      {/* Provider */}
      {provider && (
        <div className="mt-6 flex items-center gap-3 rounded-xl border border-gray-200 bg-white p-4">
          {provider.avatar_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={provider.avatar_url}
              alt={provider.full_name ?? 'Provider'}
              className="h-10 w-10 rounded-full object-cover"
            />
          ) : (
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-green-100 text-sm font-semibold text-green-700">
              {initials}
            </div>
          )}
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-gray-900">
              {provider.full_name ?? 'Anonymous'}
            </p>
            <span className="inline-flex items-center gap-1 text-xs text-indigo-600">
              <ShieldCheck className="h-3 w-3" aria-hidden />
              Trust score: {provider.trust_score}/100
            </span>
          </div>
        </div>
      )}

      {/* CTA */}
      <div className="mt-6">
        {isOwner ? (
          <p className="text-sm italic text-gray-400">This is your listing.</p>
        ) : user ? (
          <RequestSwapButton
            itemId={item.id}
            counterpartyId={item.provider_id}
            isLocked={isLocked}
          />
        ) : (
          <Link
            href="/login"
            className="inline-flex items-center gap-2 rounded-lg bg-green-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-green-700"
          >
            Sign in to request a swap
          </Link>
        )}
      </div>
    </div>
  )
}
