// src/types/user.ts
// Types mirroring the public.users table and auth-related Server Actions.

// ---------------------------------------------------------------------------
// UserProfile — mirrors every column in public.users
// ---------------------------------------------------------------------------
export interface UserProfile {
  id: string          // UUID, FK → auth.users.id
  full_name: string | null
  avatar_url: string | null
  trust_score: number // 0–100, default 50
  created_at: string  // ISO-8601
  updated_at: string  // ISO-8601
}

// ---------------------------------------------------------------------------
// Auth action shapes
// ---------------------------------------------------------------------------

export interface SignUpInput {
  email: string
  password: string
  full_name: string
}

/** Returned by auth Server Actions. `error` is null on success. */
export interface AuthActionResult {
  error: string | null
}
