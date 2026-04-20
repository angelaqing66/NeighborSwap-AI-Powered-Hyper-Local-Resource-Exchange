import Link from 'next/link'
import { ShieldCheck, Search, ArrowLeftRight, Wrench, Scissors, Sprout, Leaf } from 'lucide-react'

// ── Category data ─────────────────────────────────────────────────────────────

const CATEGORIES = [
  { label: 'Power Drill', icon: Wrench, color: 'bg-orange-100 text-orange-600' },
  { label: 'Sewing', icon: Scissors, color: 'bg-purple-100 text-purple-600' },
  { label: 'Gardening', icon: Sprout, color: 'bg-green-100 text-green-700' },
]

const HOW_IT_WORKS = [
  {
    step: 1,
    title: 'Verify & Get Started',
    body: 'Create a free account and join your trusted neighborhood network.',
    icon: ShieldCheck,
  },
  {
    step: 2,
    title: 'Browse and Request Tools',
    body: 'Browse tools and resources listed by neighbors near you.',
    icon: Search,
  },
  {
    step: 3,
    title: 'Connect & Swap Safely',
    body: 'Swap safely with AI moderation and community trust scores.',
    icon: ArrowLeftRight,
  },
]

// ── Page ──────────────────────────────────────────────────────────────────────

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col bg-gray-50">
      {/* ── Nav ── */}
      <header className="border-b border-gray-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-green-600">
              <Leaf className="h-4 w-4 text-white" />
            </span>
            <span className="text-base font-bold text-gray-900">NeighborSwap</span>
          </Link>

          {/* Auth actions */}
          <nav className="flex items-center gap-3">
            <Link
              href="/login"
              className="rounded-md border border-gray-300 bg-white px-4 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
            >
              Log In
            </Link>
            <Link
              href="/register"
              className="rounded-md bg-green-600 px-4 py-1.5 text-sm font-semibold text-white hover:bg-green-700 transition-colors"
            >
              Sign Up
            </Link>
          </nav>
        </div>
      </header>

      {/* ── Hero ── */}
      <section className="relative overflow-hidden bg-white">
        <div className="mx-auto grid max-w-6xl grid-cols-1 gap-8 px-6 py-14 lg:grid-cols-2 lg:gap-12 lg:py-20">
          {/* Left — headline + CTAs */}
          <div className="flex flex-col justify-center">
            <h1 className="text-4xl font-extrabold leading-tight tracking-tight text-gray-900 sm:text-5xl lg:text-[3.25rem]">
              Borrow tools and <span className="text-green-600">connect with</span> your local
              community.
            </h1>
            <p className="mt-5 max-w-lg text-lg leading-relaxed text-gray-500">
              Save money and share resources. Find anything in your neighborhood with
              NeighborSwap&apos;s trusted network.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                href="/listings"
                className="rounded-full bg-green-600 px-6 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-green-700 transition-colors"
              >
                Find a Tool
              </Link>
              <Link
                href="/listings/new"
                className="rounded-full border border-gray-300 bg-white px-6 py-2.5 text-sm font-semibold text-gray-700 shadow-sm hover:bg-gray-50 transition-colors"
              >
                List an Item
              </Link>
            </div>
          </div>

          {/* Right — image placeholder + How It Works card */}
          <div className="relative flex flex-col gap-4">
            {/* Hero image */}
            <div className="relative h-56 w-full overflow-hidden rounded-2xl bg-gradient-to-br from-green-100 via-emerald-50 to-teal-100 sm:h-64 lg:h-72">
              {/* Decorative circles to evoke the community/garden photo in the mockup */}
              <div className="absolute -bottom-6 -right-6 h-40 w-40 rounded-full bg-green-200/60" />
              <div className="absolute -top-4 -left-4 h-28 w-28 rounded-full bg-emerald-200/50" />
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="flex items-center gap-3 rounded-xl bg-white/70 px-5 py-3 backdrop-blur-sm shadow-sm">
                  <Leaf className="h-6 w-6 text-green-600" />
                  <span className="text-sm font-medium text-gray-700">
                    Your neighborhood, shared.
                  </span>
                </div>
              </div>
            </div>

            {/* How It Works card */}
            <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
              <h2 className="mb-4 text-sm font-bold uppercase tracking-wide text-gray-400">
                How It Works
              </h2>
              <ol className="space-y-4">
                {HOW_IT_WORKS.map(({ step, title, body, icon: Icon }) => (
                  <li key={step} className="flex items-start gap-3">
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-green-600 text-xs font-bold text-white">
                      {step}
                    </span>
                    <div>
                      <p className="text-sm font-semibold text-gray-800 flex items-center gap-1.5">
                        <Icon className="h-3.5 w-3.5 text-green-500" aria-hidden />
                        {title}
                      </p>
                      <p className="mt-0.5 text-xs leading-relaxed text-gray-500">{body}</p>
                    </div>
                  </li>
                ))}
              </ol>
            </div>
          </div>
        </div>
      </section>

      {/* ── Browse Local Tools ── */}
      <section className="border-t border-gray-200 bg-white px-6 py-10">
        <div className="mx-auto max-w-6xl">
          <h2 className="mb-5 text-base font-bold text-gray-900">Browse Local Tools</h2>

          <div className="flex flex-wrap items-center gap-3">
            {CATEGORIES.map(({ label, icon: Icon, color }) => (
              <Link
                key={label}
                href={`/listings?category=${encodeURIComponent(label.toLowerCase())}`}
                className={`flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition-opacity hover:opacity-80 ${color}`}
              >
                <Icon className="h-4 w-4" aria-hidden />
                {label}
              </Link>
            ))}

            {/* Decorative colour dots — category-count indicators in the mockup */}
            <div className="ml-2 flex items-center gap-1.5">
              <span className="h-3 w-3 rounded-full bg-orange-400" />
              <span className="h-3 w-3 rounded-full bg-purple-400" />
              <span className="h-3 w-3 rounded-full bg-green-500" />
            </div>

            {/* Browse all CTA */}
            <Link
              href="/listings"
              className="ml-auto rounded-full border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors"
            >
              View all →
            </Link>
          </div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="mt-auto border-t border-gray-100 bg-gray-50 px-6 py-4 text-center text-xs text-gray-400">
        © {new Date().getFullYear()} NeighborSwap. All rights reserved.
      </footer>
    </div>
  )
}
