// src/lib/listings.ts
// Server-side query helper for fetching listings from the items table.

import { createClient } from '@/lib/supabase/server'
import type { Listing } from '@/types/listings'

export interface GetListingsParams {
  search?: string
  status?: 'available' | 'borrowed' | 'unlisted'
}

export async function getListings(params: GetListingsParams): Promise<Listing[]> {
  const supabase = await createClient()
  const status = params.status ?? 'available'
  const trimmed = params.search?.trim() ?? ''

  let query = supabase
    .from('items')
    .select('*')
    .eq('status', status)
    .order('created_at', { ascending: false })

  if (trimmed.length > 0) {
    query = query.ilike('title', `%${trimmed}%`)
  }

  const { data, error } = await query

  if (error) return []
  return (data ?? []) as Listing[]
}
