'use server'

// src/actions/listings.ts
// Server Actions for item listings.
// All DB writes and storage uploads happen here — never in client components.

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { runSafety } from '@/lib/agents/safety'
import type { ListingActionResult } from '@/types/listings'

// ---------------------------------------------------------------------------
// createListingAction
//
// Validates the "Post an Item" form, runs the safety agent, optionally
// uploads a photo to Supabase Storage, then inserts a row in public.items.
//
// On success  → redirects to /listings
// On failure  → returns { error: message } for the form to display
// ---------------------------------------------------------------------------
export async function createListingAction(
  _prevState: ListingActionResult,
  formData: FormData
): Promise<ListingActionResult> {
  // 1. Auth — must be signed in to post
  const supabase = await createClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return { error: 'You must be signed in to post an item.' }
  }

  // 2. Extract and validate required fields
  const title = formData.get('title')
  const description = formData.get('description')

  if (typeof title !== 'string' || !title.trim()) {
    return { error: 'Title is required.' }
  }
  if (typeof description !== 'string' || !description.trim()) {
    return { error: 'Description is required.' }
  }

  const trimmedTitle = title.trim()
  const trimmedDescription = description.trim()

  // 3. Extract optional fields
  const borrowingRulesRaw = formData.get('borrowing_rules')
  const returnByDateRaw = formData.get('return_by_date')

  const borrowingRules =
    typeof borrowingRulesRaw === 'string' && borrowingRulesRaw.trim()
      ? borrowingRulesRaw.trim()
      : null

  const returnByDate =
    typeof returnByDateRaw === 'string' && returnByDateRaw.trim() ? returnByDateRaw.trim() : null

  // 4. Generate a stable ID upfront so it can be used in both the
  //    safety audit correlation and the storage file path.
  const listingId = crypto.randomUUID()

  // 5. Run safety agent — blocks prohibited content before anything is stored.
  //    trade_id and initiator_id are audit-only fields never forwarded to Groq.
  const safetyResult = await runSafety({
    trade_id: listingId,
    initiator_id: user.id,
    listing_title: trimmedTitle,
    listing_description: trimmedDescription,
    agreed_terms: borrowingRules,
  })

  if (safetyResult.verdict === 'block') {
    return {
      error: `This listing was flagged and cannot be published. ${safetyResult.reasoning}`,
    }
  }

  // 6. Upload photo if provided
  const photo = formData.get('photo')
  let imageUrl: string | null = null

  if (photo instanceof File && photo.size > 0) {
    const ext = photo.name.split('.').pop() ?? 'jpg'
    const storagePath = `${user.id}/${listingId}.${ext}`

    const { error: uploadError } = await supabase.storage
      .from('item-photos')
      .upload(storagePath, photo, { contentType: photo.type, upsert: false })

    if (uploadError) {
      return { error: `Photo upload failed: ${uploadError.message}` }
    }

    const {
      data: { publicUrl },
    } = supabase.storage.from('item-photos').getPublicUrl(storagePath)
    imageUrl = publicUrl
  }

  // 7. Use the safety-redacted description if the agent returned one
  //    (verdict 'review' means PII was detected and redacted).
  const finalDescription = safetyResult.redacted_description ?? trimmedDescription

  // 8. Insert the listing
  const { error: insertError } = await supabase.from('items').insert({
    id: listingId,
    provider_id: user.id,
    title: trimmedTitle,
    description: finalDescription,
    image_url: imageUrl,
    borrowing_rules: borrowingRules,
    return_by_date: returnByDate,
    status: 'available',
  })

  if (insertError) {
    return { error: `Failed to create listing: ${insertError.message}` }
  }

  redirect('/listings')
}
