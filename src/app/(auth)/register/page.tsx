// src/app/(auth)/register/page.tsx
// Sign-up page — server component that renders the client form.

import type { Metadata } from 'next'
import SignUpForm from '@/components/auth/SignUpForm'

export const metadata: Metadata = {
  title: 'Create account — NeighborSwap',
}

export default function RegisterPage() {
  return (
    <>
      <h2 className="mb-6 text-xl font-semibold text-gray-900">Create account</h2>
      <SignUpForm />
    </>
  )
}
