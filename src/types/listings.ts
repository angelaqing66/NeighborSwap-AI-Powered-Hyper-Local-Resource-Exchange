// src/types/listings.ts
// Mirrors the public.items table and listing-related Server Actions.

export type ItemStatus = 'available' | 'borrowed' | 'unlisted'

// ---------------------------------------------------------------------------
// Listing — mirrors every column in public.items
// ---------------------------------------------------------------------------
export interface Listing {
  id: string
  provider_id: string
  title: string
  description: string
  image_url: string | null
  borrowing_rules: string | null
  return_by_date: string | null // ISO date 'YYYY-MM-DD', from DATE column
  status: ItemStatus
  created_at: string
  updated_at: string
}

// ---------------------------------------------------------------------------
// CreateListingInput — payload for the createListingAction Server Action
// ---------------------------------------------------------------------------
export interface CreateListingInput {
  provider_id: string
  title: string
  description: string
  image_url?: string | null
  borrowing_rules?: string | null
  return_by_date?: string | null
}

// ---------------------------------------------------------------------------
// ListingActionResult — returned by listing Server Actions
// ---------------------------------------------------------------------------
export interface ListingActionResult {
  error: string | null
  listing_id?: string
}
