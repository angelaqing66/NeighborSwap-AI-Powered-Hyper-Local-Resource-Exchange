'use client'

// src/components/listings/SearchBar.tsx
// Client component — updates the ?q= URL search param on input change (debounced).

import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import { useCallback, useEffect, useRef } from 'react'
import { Search } from 'lucide-react'

interface SearchBarProps {
  defaultSearch?: string
}

export default function SearchBar({ defaultSearch = '' }: SearchBarProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const updateSearch = useCallback(
    (value: string) => {
      const params = new URLSearchParams(searchParams.toString())
      if (value.trim()) {
        params.set('q', value.trim())
      } else {
        params.delete('q')
      }
      router.replace(`${pathname}?${params.toString()}`)
    },
    [router, pathname, searchParams]
  )

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [])

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const value = e.target.value
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => updateSearch(value), 300)
  }

  return (
    <div className="relative mb-4 max-w-sm">
      <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" aria-hidden />
      <input
        type="search"
        placeholder="Search items..."
        defaultValue={defaultSearch}
        onChange={handleChange}
        className="w-full rounded-lg border border-gray-300 bg-white py-2 pl-9 pr-3 text-sm placeholder-gray-400 focus:border-green-500 focus:outline-none focus:ring-1 focus:ring-green-500"
        aria-label="Search items"
      />
    </div>
  )
}
