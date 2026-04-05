// src/app/(auth)/layout.tsx
// Shared layout for auth pages (register, login, etc.).
// Centres the card on screen with a light background.

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4 py-12">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold tracking-tight text-gray-900">
            NeighborSwap
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            Hyper-local resource exchange
          </p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-8 shadow-sm">
          {children}
        </div>
      </div>
    </div>
  )
}
