// src/app/(auth)/register/success/page.tsx
// Shown after a successful sign-up submission.
// Supabase sends an email confirmation link; the user must verify before logging in.

import type { Metadata } from 'next'
import { MailCheck } from 'lucide-react'

export const metadata: Metadata = {
  title: 'Check your email — NeighborSwap',
}

export default function RegisterSuccessPage() {
  return (
    <div className="flex flex-col items-center gap-4 text-center">
      <MailCheck className="h-12 w-12 text-green-500" aria-hidden />
      <h2 className="text-xl font-semibold text-gray-900">Check your email</h2>
      <p className="text-sm text-gray-600">
        We sent a confirmation link to your email address. Click the link to activate your account
        and start swapping with your neighbors.
      </p>
      <a href="/login" className="mt-2 text-sm font-medium text-green-600 hover:underline">
        Back to sign in
      </a>
    </div>
  )
}
