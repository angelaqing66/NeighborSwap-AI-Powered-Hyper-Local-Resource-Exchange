// src/lib/supabase/server.ts
// Server-side Supabase client.
// Import this in Server Actions, Route Handlers, and server components.
// Never import this inside a 'use client' component.

import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function createClient() {
  const cookieStore = await cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // setAll is called from a Server Component — cookie mutations are
            // only possible inside a Server Action or Route Handler.
          }
        },
      },
    }
  )
}
