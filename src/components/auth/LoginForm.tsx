'use client'

import { useActionState } from 'react'
import { Loader2, ShieldCheck } from 'lucide-react'
import { signInAction, signInAsAdminAction } from '@/actions/auth'
import type { AuthActionResult } from '@/types/user'

const initialState: AuthActionResult = { error: null }

export default function LoginForm() {
  const [state, formAction, pending] = useActionState(signInAction, initialState)
  const [adminState, adminFormAction, adminPending] = useActionState(
    signInAsAdminAction,
    initialState
  )

  const errorMsg = state.error ?? adminState.error

  return (
    <div className="space-y-6">
      <form action={formAction} className="space-y-5">
        {errorMsg && (
          <div
            role="alert"
            className="rounded-md border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-700"
          >
            {errorMsg}
          </div>
        )}

        <div>
          <label htmlFor="email" className="mb-1 block text-sm font-medium text-gray-700">
            Email address
          </label>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            required
            className="block w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm placeholder:text-gray-400 focus:border-green-500 focus:outline-none focus:ring-1 focus:ring-green-500"
            placeholder="jane@example.com"
          />
        </div>

        <div>
          <label htmlFor="password" className="mb-1 block text-sm font-medium text-gray-700">
            Password
          </label>
          <input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
            className="block w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm placeholder:text-gray-400 focus:border-green-500 focus:outline-none focus:ring-1 focus:ring-green-500"
            placeholder="Your password"
          />
        </div>

        <button
          type="submit"
          disabled={pending || adminPending}
          className="flex w-full items-center justify-center gap-2 rounded-md bg-green-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {pending && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
          {pending ? 'Signing in…' : 'Sign in'}
        </button>

        <p className="text-center text-sm text-gray-500">
          Don&apos;t have an account?{' '}
          <a href="/register" className="font-medium text-green-600 hover:underline">
            Create one
          </a>
        </p>
      </form>

      {/* Admin quick-login */}
      <div className="rounded-lg border border-indigo-200 bg-indigo-50 p-4">
        <div className="mb-2 flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-indigo-600" aria-hidden />
          <span className="text-xs font-semibold uppercase tracking-wide text-indigo-700">
            Admin Access
          </span>
        </div>
        <p className="mb-3 text-xs text-indigo-600">
          Sign in as the platform administrator to access the developer dashboard and all user
          content.
        </p>
        <form action={adminFormAction}>
          <button
            type="submit"
            disabled={pending || adminPending}
            className="flex w-full items-center justify-center gap-2 rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {adminPending && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
            {adminPending ? 'Signing in…' : 'Login as Admin'}
          </button>
        </form>
      </div>
    </div>
  )
}
