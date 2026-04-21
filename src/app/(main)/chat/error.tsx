'use client'

// Catches unhandled server errors in the /chat route tree.
// Shows the actual error message so we can diagnose it.

import { useEffect } from 'react'
import { AlertTriangle } from 'lucide-react'

export default function ChatError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('[ChatError boundary]', error)
  }, [error])

  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 p-8 text-center">
      <AlertTriangle className="h-8 w-8 text-red-400" />
      <p className="text-sm font-medium text-gray-700">Something went wrong loading this chat.</p>
      <p className="max-w-sm rounded bg-red-50 px-3 py-2 font-mono text-xs text-red-700">
        {error.message || 'Unknown server error'}
        {error.digest && <span className="ml-1 text-red-400">(digest: {error.digest})</span>}
      </p>
      <button
        onClick={reset}
        className="rounded-md border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50"
      >
        Try again
      </button>
    </div>
  )
}
