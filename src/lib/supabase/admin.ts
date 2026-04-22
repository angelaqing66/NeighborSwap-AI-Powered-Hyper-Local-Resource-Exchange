// src/lib/supabase/admin.ts
// Service-role Supabase client — bypasses RLS for admin-only server-side operations.
// NEVER import this in client components or any code path reachable by the browser.

import { createClient } from '@supabase/supabase-js'

export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !serviceRoleKey) {
    throw new Error('Missing Supabase admin credentials')
  }

  return createClient(url, serviceRoleKey, {
    auth: { persistSession: false },
  })
}
