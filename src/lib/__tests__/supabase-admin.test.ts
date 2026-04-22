// src/lib/__tests__/supabase-admin.test.ts
// Unit tests for the service-role Supabase admin client.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({ from: vi.fn() })),
}))

import { createClient } from '@supabase/supabase-js'
import { createAdminClient } from '../supabase/admin'

const mockCreateClient = vi.mocked(createClient)

describe('createAdminClient', () => {
  const ORIG_ENV = process.env

  beforeEach(() => {
    process.env = { ...ORIG_ENV }
    vi.clearAllMocks()
  })

  afterEach(() => {
    process.env = ORIG_ENV
  })

  it('throws when both env vars are absent', () => {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL
    delete process.env.SUPABASE_SERVICE_ROLE_KEY

    expect(() => createAdminClient()).toThrow('Missing Supabase admin credentials')
  })

  it('throws when NEXT_PUBLIC_SUPABASE_URL is absent', () => {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-key'

    expect(() => createAdminClient()).toThrow('Missing Supabase admin credentials')
  })

  it('throws when SUPABASE_SERVICE_ROLE_KEY is absent', () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co'
    delete process.env.SUPABASE_SERVICE_ROLE_KEY

    expect(() => createAdminClient()).toThrow('Missing Supabase admin credentials')
  })

  it('calls createClient with the service role key and persistSession false', () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co'
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-secret'

    createAdminClient()

    expect(mockCreateClient).toHaveBeenCalledOnce()
    expect(mockCreateClient).toHaveBeenCalledWith(
      'https://test.supabase.co',
      'service-role-secret',
      { auth: { persistSession: false } }
    )
  })

  it('returns the client produced by createClient', () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co'
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-secret'

    const client = createAdminClient()

    expect(client).toBe(mockCreateClient.mock.results[0].value)
  })
})
