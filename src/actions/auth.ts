'use server'

// actions/auth.ts
// Server Actions for user authentication.
// All Supabase Auth calls happen here — never in client components.

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import type { AuthActionResult } from '@/types/user'

// ---------------------------------------------------------------------------
// signUpAction
//
// Registers a new user via Supabase Auth.
// The DB trigger `on_auth_user_created` auto-inserts a row in public.users
// with full_name from auth.users.raw_user_meta_data.
//
// On success → redirects to /register/success (Supabase sends a confirm email).
// On failure → returns { error: message } so the form can display it.
// ---------------------------------------------------------------------------
export async function signUpAction(
  _prevState: AuthActionResult,
  formData: FormData
): Promise<AuthActionResult> {
  const email = formData.get('email')
  const password = formData.get('password')
  const full_name = formData.get('full_name')

  if (typeof email !== 'string' || typeof password !== 'string' || typeof full_name !== 'string') {
    return { error: 'Invalid form submission.' }
  }

  const trimmedEmail = email.trim()
  const trimmedName = full_name.trim()

  if (!trimmedEmail || !trimmedName) {
    return { error: 'Email and full name are required.' }
  }

  if (password.length < 8) {
    return { error: 'Password must be at least 8 characters.' }
  }

  const supabase = await createClient()

  const { error } = await supabase.auth.signUp({
    email: trimmedEmail,
    password,
    options: {
      data: { full_name: trimmedName },
    },
  })

  if (error) {
    return { error: error.message }
  }

  redirect('/register/success')
}

// ---------------------------------------------------------------------------
// signInAction
//
// Signs in an existing user via Supabase Auth (email + password).
// Supabase sets the session cookies via the server client cookie handlers.
//
// On success → redirects to / (app home).
// On failure → returns { error: message } so the form can display it.
// ---------------------------------------------------------------------------
export async function signInAction(
  _prevState: AuthActionResult,
  formData: FormData
): Promise<AuthActionResult> {
  const email = formData.get('email')
  const password = formData.get('password')

  if (typeof email !== 'string' || typeof password !== 'string') {
    return { error: 'Invalid form submission.' }
  }

  const trimmedEmail = email.trim()

  if (!trimmedEmail || !password) {
    return { error: 'Email and password are required.' }
  }

  const supabase = await createClient()

  const { error } = await supabase.auth.signInWithPassword({
    email: trimmedEmail,
    password,
  })

  if (error) {
    return { error: error.message }
  }

  redirect('/')
}
