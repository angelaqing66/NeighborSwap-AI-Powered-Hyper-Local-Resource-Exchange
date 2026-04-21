'use client'

// src/hooks/useListings.ts
// Real-time listings hook powered by Supabase Realtime subscriptions.
// Tracks inserts, updates, and deletes on the items table for the 'available' status.

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Listing } from '@/types/listings'

interface UseListingsResult {
  listings: Listing[]
  loading: boolean
  error: string | null
}

export function useListings(): UseListingsResult {
  const [listings, setListings] = useState<Listing[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const supabase = createClient()
    let cancelled = false

    async function fetchInitial() {
      const { data, error: fetchError } = await supabase
        .from('items')
        .select('*')
        .eq('status', 'available')
        .order('created_at', { ascending: false })

      if (cancelled) return

      if (fetchError) {
        setError('Could not load listings.')
      } else {
        setListings((data ?? []) as Listing[])
      }
      setLoading(false)
    }

    fetchInitial()

    // Subscribe to real-time changes on the items table
    const channel = supabase
      .channel('items-realtime')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'items', filter: 'status=eq.available' },
        (payload) => {
          if (!cancelled) {
            setListings((prev) => [payload.new as Listing, ...prev])
          }
        }
      )
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'items' }, (payload) => {
        if (!cancelled) {
          const updated = payload.new as Listing
          setListings((prev) =>
            updated.status === 'available'
              ? prev.map((l) => (l.id === updated.id ? updated : l))
              : prev.filter((l) => l.id !== updated.id)
          )
        }
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'items' }, (payload) => {
        if (!cancelled) {
          const deleted = payload.old as Pick<Listing, 'id'>
          setListings((prev) => prev.filter((l) => l.id !== deleted.id))
        }
      })
      .subscribe()

    return () => {
      cancelled = true
      supabase.removeChannel(channel)
    }
  }, [])

  return { listings, loading, error }
}
