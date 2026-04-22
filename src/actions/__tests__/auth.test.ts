// actions/__tests__/auth.test.ts
// Unit tests for signUpAction and signInAction Server Actions.
// Mocks the Supabase server client and next/navigation — never calls real APIs.

import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── Mocks (must be declared before dynamic import of the module under test) ──

const mockSignUp = vi.fn()
const mockSignInWithPassword = vi.fn()

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn().mockResolvedValue({
    auth: {
      signUp: mockSignUp,
      signInWithPassword: mockSignInWithPassword,
    },
  }),
}))

const mockRedirect = vi.fn()
vi.mock('next/navigation', () => ({
  redirect: mockRedirect,
}))

// Lazy import AFTER mocks are hoisted
const { signUpAction, signInAction, signInAsAdminAction } = await import('../auth')

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeFormData(fields: Record<string, string>): FormData {
  const fd = new FormData()
  for (const [key, value] of Object.entries(fields)) {
    fd.append(key, value)
  }
  return fd
}

const prevState = { error: null }

// ── signUpAction tests ────────────────────────────────────────────────────────

describe('signUpAction', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns an error when required fields are missing', async () => {
    const fd = makeFormData({ email: '', full_name: '', password: 'secret123' })
    const result = await signUpAction(prevState, fd)
    expect(result.error).toBeTruthy()
    expect(mockSignUp).not.toHaveBeenCalled()
  })

  it('returns an error when password is shorter than 8 chars', async () => {
    const fd = makeFormData({
      email: 'user@example.com',
      full_name: 'Alice',
      password: 'short',
    })
    const result = await signUpAction(prevState, fd)
    expect(result.error).toMatch(/8 characters/i)
    expect(mockSignUp).not.toHaveBeenCalled()
  })

  it('returns the Supabase error message when sign-up fails', async () => {
    mockSignUp.mockResolvedValue({
      data: null,
      error: { message: 'User already registered' },
    })

    const fd = makeFormData({
      email: 'existing@example.com',
      full_name: 'Bob',
      password: 'password123',
    })
    const result = await signUpAction(prevState, fd)
    expect(result.error).toBe('User already registered')
  })

  it('redirects to /register/success on successful sign-up', async () => {
    mockSignUp.mockResolvedValue({ data: { user: { id: 'abc' } }, error: null })

    const fd = makeFormData({
      email: 'new@example.com',
      full_name: 'Carol',
      password: 'password123',
    })

    await signUpAction(prevState, fd)

    expect(mockSignUp).toHaveBeenCalledOnce()
    expect(mockSignUp).toHaveBeenCalledWith({
      email: 'new@example.com',
      password: 'password123',
      options: { data: { full_name: 'Carol' } },
    })
    expect(mockRedirect).toHaveBeenCalledWith('/register/success')
  })

  it('trims whitespace from email and full_name before calling Supabase', async () => {
    mockSignUp.mockResolvedValue({ data: { user: { id: 'xyz' } }, error: null })

    const fd = makeFormData({
      email: '  user@example.com  ',
      full_name: '  Dave  ',
      password: 'password123',
    })

    await signUpAction(prevState, fd)

    expect(mockSignUp).toHaveBeenCalledWith(
      expect.objectContaining({
        email: 'user@example.com',
        options: { data: { full_name: 'Dave' } },
      })
    )
  })
})

// ── signInAction tests ────────────────────────────────────────────────────────

describe('signInAction', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns an error when email is empty', async () => {
    const fd = makeFormData({ email: '', password: 'password123' })
    const result = await signInAction(prevState, fd)
    expect(result.error).toBeTruthy()
    expect(mockSignInWithPassword).not.toHaveBeenCalled()
  })

  it('returns an error when password is empty', async () => {
    const fd = makeFormData({ email: 'user@example.com', password: '' })
    const result = await signInAction(prevState, fd)
    expect(result.error).toBeTruthy()
    expect(mockSignInWithPassword).not.toHaveBeenCalled()
  })

  it('returns the Supabase error message on invalid credentials', async () => {
    mockSignInWithPassword.mockResolvedValue({
      data: null,
      error: { message: 'Invalid login credentials' },
    })

    const fd = makeFormData({
      email: 'user@example.com',
      password: 'wrongpassword',
    })
    const result = await signInAction(prevState, fd)
    expect(result.error).toBe('Invalid login credentials')
    expect(mockRedirect).not.toHaveBeenCalled()
  })

  it('redirects to / on successful sign-in', async () => {
    mockSignInWithPassword.mockResolvedValue({
      data: { user: { id: 'abc' }, session: { access_token: 'tok' } },
      error: null,
    })

    const fd = makeFormData({
      email: 'user@example.com',
      password: 'correctpassword',
    })

    await signInAction(prevState, fd)

    expect(mockSignInWithPassword).toHaveBeenCalledOnce()
    expect(mockSignInWithPassword).toHaveBeenCalledWith({
      email: 'user@example.com',
      password: 'correctpassword',
    })
    expect(mockRedirect).toHaveBeenCalledWith('/')
  })

  it('trims whitespace from email before calling Supabase', async () => {
    mockSignInWithPassword.mockResolvedValue({
      data: { user: { id: 'abc' }, session: {} },
      error: null,
    })

    const fd = makeFormData({
      email: '  user@example.com  ',
      password: 'password123',
    })

    await signInAction(prevState, fd)

    expect(mockSignInWithPassword).toHaveBeenCalledWith(
      expect.objectContaining({ email: 'user@example.com' })
    )
  })
})

// ── signInAsAdminAction tests ─────────────────────────────────────────────────

describe('signInAsAdminAction', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('calls signInWithPassword with the hardcoded admin credentials', async () => {
    mockSignInWithPassword.mockResolvedValue({
      data: { user: { id: 'admin-uid' }, session: { access_token: 'tok' } },
      error: null,
    })

    const fd = new FormData()
    await signInAsAdminAction(prevState, fd)

    expect(mockSignInWithPassword).toHaveBeenCalledOnce()
    expect(mockSignInWithPassword).toHaveBeenCalledWith({
      email: 'neighborswapAdmin@gmail.com',
      password: '12345678',
    })
  })

  it('redirects to / on successful admin sign-in', async () => {
    mockSignInWithPassword.mockResolvedValue({
      data: { user: { id: 'admin-uid' }, session: { access_token: 'tok' } },
      error: null,
    })

    await signInAsAdminAction(prevState, new FormData())

    expect(mockRedirect).toHaveBeenCalledWith('/')
  })

  it('returns an error when Supabase rejects the admin credentials', async () => {
    mockSignInWithPassword.mockResolvedValue({
      data: null,
      error: { message: 'Invalid login credentials' },
    })

    const result = await signInAsAdminAction(prevState, new FormData())

    expect(result.error).toBe('Invalid login credentials')
    expect(mockRedirect).not.toHaveBeenCalled()
  })
})
