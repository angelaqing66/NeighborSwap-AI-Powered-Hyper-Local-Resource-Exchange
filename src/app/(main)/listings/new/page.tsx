// src/app/(main)/listings/new/page.tsx
// "Post an Item" page — server component with auth guard.
// Unauthenticated visitors are redirected to /login.

import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import PostItemForm from '@/components/listings/PostItemForm'

export const metadata: Metadata = {
  title: 'Post an Item — NeighborSwap',
}

export default async function NewListingPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  return (
    <>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Post an item</h1>
        <p className="mt-1 text-sm text-gray-500">
          Share something with your neighbors. Your listing is reviewed by our safety agent before
          publishing.
        </p>
      </div>
      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <PostItemForm />
      </div>
    </>
  )
}
