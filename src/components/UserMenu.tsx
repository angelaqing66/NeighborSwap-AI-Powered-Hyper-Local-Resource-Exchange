'use client'

import { useState, useRef, useEffect } from 'react'
import Link from 'next/link'
import { ChevronDown, Settings, LogOut, ShieldCheck } from 'lucide-react'
import { signOutAction } from '@/actions/auth'

interface UserMenuProps {
  email: string
  isAdmin?: boolean
}

export default function UserMenu({ email, isAdmin = false }: UserMenuProps) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  const initial = (email[0] ?? '?').toUpperCase()

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className={`flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-sm font-medium transition-colors ${
          isAdmin
            ? 'bg-indigo-100 text-indigo-800 hover:bg-indigo-200'
            : 'bg-green-100 text-green-800 hover:bg-green-200'
        }`}
        aria-expanded={open}
        aria-haspopup="menu"
      >
        <span
          className={`flex h-5 w-5 items-center justify-center rounded-full text-xs font-bold text-white ${
            isAdmin ? 'bg-indigo-600' : 'bg-green-600'
          }`}
        >
          {initial}
        </span>
        <ChevronDown className="h-3.5 w-3.5" />
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 mt-2 w-52 rounded-xl border border-gray-200 bg-white py-1 shadow-lg z-50"
        >
          <div className="border-b border-gray-100 px-4 py-2.5">
            <p className="truncate text-xs text-gray-500">{email}</p>
            {isAdmin && (
              <div className="mt-1 flex items-center gap-1 text-xs font-semibold text-indigo-600">
                <ShieldCheck className="h-3 w-3" aria-hidden />
                Admin
              </div>
            )}
          </div>

          <Link
            href="/profile"
            role="menuitem"
            onClick={() => setOpen(false)}
            className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
          >
            <Settings className="h-4 w-4 text-gray-400" />
            Profile settings
          </Link>

          <form action={signOutAction}>
            <button
              type="submit"
              role="menuitem"
              className="flex w-full items-center gap-2.5 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 transition-colors"
            >
              <LogOut className="h-4 w-4" />
              Sign out
            </button>
          </form>
        </div>
      )}
    </div>
  )
}
