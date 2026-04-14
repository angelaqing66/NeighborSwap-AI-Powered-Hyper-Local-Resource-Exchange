// src/app/(auth)/login/page.tsx
// Sign-in page — server component that renders the client form.

import type { Metadata } from 'next'
import LoginForm from '@/components/auth/LoginForm'

export const metadata: Metadata = {
  title: 'Sign in — NeighborSwap',
}

export default function LoginPage() {
  return (
    <>
      <h2 className="mb-6 text-xl font-semibold text-gray-900">Sign in to your account</h2>
      <LoginForm />
    </>
  )
}
