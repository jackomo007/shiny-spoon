"use client"

import Link from "next/link"
import Image from "next/image"
import { useState } from "react"
import { signOut } from "next-auth/react"
import AccountSwitcher from "@/components/account/AccountSwitcher"

type Props = {
  children: React.ReactNode
  displayName?: string
}

const nav = [
  { href: "/dashboard", label: "Home", icon: "🏠" },
  { href: "/market-analysis", label: "Market Analysis", icon: "⚙️" },
  { href: "/trading-course", label: "Trading Course", icon: "🎓" },
  { href: "/journal", label: "Trading Journal", icon: "🗒️" },
  { href: "/strategies", label: "Strategy Creator", icon: "🧭" },
  { href: "/trade-analyzer", label: "Trade Analyzer", icon: "📈" },
]

export default function DashboardShell({
  children,
  displayName = "John Snow",
}: Props) {
  const [openProfile, setOpenProfile] = useState(false)
  const [accOpen, setAccOpen] = useState(false)

  return (
    <div className="min-h-dvh bg-gray-50">
      <div className="bg-primary text-white">
        <div className="mx-auto max-w-7xl flex items-center justify-between px-6 py-4">
          <div className="flex items-center gap-6">
            <Image src="/img/brand/white.png" alt="Logo" width={128} height={24} />
            <nav className="hidden md:flex gap-6 opacity-90">
              <Link href="/dashboard">Home</Link>
              <Link href="/journal">Trading Journal</Link>
              <Link href="/strategies">Strategy Creator</Link>
              <Link href="/trade-analyzer">Trade Analyzer</Link>
            </nav>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setAccOpen(true)}
              className="hidden sm:inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1.5 hover:bg-white/20"
              title="Switch account"
            >
              <span>👥</span> Accounts
            </button>

            <div className="relative">
              <button
                onClick={() => setOpenProfile((v) => !v)}
                className="flex items-center gap-2 rounded-full bg-white/15 px-3 py-1.5 hover:bg-white/20"
              >
                <span className="h-8 w-8 rounded-full bg-white/20 grid place-items-center">JS</span>
                <span className="hidden sm:inline">{displayName}</span>
              </button>

              {openProfile && (
                <div
                  className="absolute right-0 mt-2 w-64 bg-white text-gray-800 rounded-2xl shadow-xl p-2 z-50"
                  onMouseLeave={() => setOpenProfile(false)}
                >
                  <div className="px-3 py-2 text-sm text-gray-500">
                    Hi, {displayName.split(" ")[0]}!
                  </div>
                  <MenuItem href="/profile" label="My profile" emoji="🙋‍♂️" />
                  <MenuItem href="#" label="Settings" emoji="⚙️" />
                  <MenuItem href="#" label="Billing" emoji="💳" />
                  <MenuItem href="#" label="Activity" emoji="📊" />

                  <button
                    className="w-full text-left flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-gray-100"
                    onClick={() => {
                      setOpenProfile(false)
                      setAccOpen(true)
                    }}
                  >
                    <span className="text-lg">🔄</span> Switch account
                  </button>

                  <button
                    className="w-full text-left flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-gray-100"
                    onClick={() => signOut({ callbackUrl: "/login" })}
                  >
                    <span className="text-lg">🚪</span> Logout
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-7xl grid grid-cols-1 md:grid-cols-[260px_1fr] gap-6 px-4 md:px-6 py-6">
        <aside className="hidden md:block">
          <div className="rounded-2xl bg-primary text-white p-6">
            <div className="h-16 w-16 rounded-full bg-white/20 grid place-items-center text-xl mb-3">
              🖼️
            </div>
            <div className="font-semibold">{displayName}</div>
            <div className="text-sm opacity-80">Level 1</div>
            <span className="inline-block mt-3 text-xs bg-white/15 rounded-full px-2 py-1">
              Free Tier
            </span>
          </div>

          <ul className="mt-6 grid gap-2">
            {nav.map((n) => (
              <li key={n.href}>
                <Link
                  className="flex items-center gap-3 rounded-xl px-3 py-2 hover:bg-gray-100"
                  href={n.href}
                >
                  <span className="w-6 text-center">{n.icon}</span>
                  <span>{n.label}</span>
                </Link>
              </li>
            ))}
          </ul>
        </aside>

        <main>{children}</main>
      </div>

     {accOpen && (
        <div
          className="fixed inset-0 z-[60] bg-black/30 backdrop-blur-[1px]"
          onClick={() => setAccOpen(false)}
        >
          <div
            className="fixed right-4 top-16 w-[460px] max-w-[95vw] rounded-2xl bg-white text-gray-800 shadow-2xl p-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-2 border-b">
              <div className="font-semibold">Switch account</div>
              <button
                className="rounded-full px-2 py-1 text-gray-500 hover:bg-gray-100"
                onClick={() => setAccOpen(false)}
                aria-label="Close"
                title="Close"
              >
                ✖
              </button>
            </div>

            <div className="pt-3">
              <AccountSwitcher onClose={() => setAccOpen(false)} />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function MenuItem({
  href,
  label,
  emoji,
}: {
  href: string
  label: string
  emoji: string
}) {
  return (
    <Link
      href={href}
      className="flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-gray-100"
    >
      <span className="text-lg">{emoji}</span> {label}
    </Link>
  )
}
