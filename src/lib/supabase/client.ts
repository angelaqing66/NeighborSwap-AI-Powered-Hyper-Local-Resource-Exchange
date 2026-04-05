// src/lib/supabase/client.ts
// Browser-side Supabase client.
// Use ONLY in 'use client' components — only for Auth state and real-time subscriptions.
// Never use this client for DB mutations (use Server Actions + the server client instead).

'use client'

import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  )
}
