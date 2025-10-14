"use client"

import Link from "next/link"
import Image from "next/image"
import { useState } from "react"
import { signOut } from "next-auth/react"
import { useSession } from "next-auth/react"
import AccountSwitcher from "@/components/account/AccountSwitcher"

type Props = { children: React.ReactNode }

function initials(from: string): string {
  const base = (from || "").trim()
  if (!base) return "U"
  const parts = base.split(/\s+/).filter(Boolean)
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase()
  const one = parts[0]
  if (one.includes("@")) return one.split("@")[0].slice(0, 2).toUpperCase()
  return one.slice(0, 2).toUpperCase()
}

export default function DashboardShell({ children }: Props) {
  const { data } = useSession()
  const displayName =
    data?.user?.name ??
    (data?.user?.email ? data.user.email.split("@")[0] : undefined) ??
    "Trader"

  const avatarText = initials(displayName)
  const isAdmin = !!data?.user?.isAdmin

  const [openProfile, setOpenProfile] = useState(false)
  const [accOpen, setAccOpen] = useState(false)
  const [courseOpen, setCourseOpen] = useState(false)

  const openComingSoon = (e?: React.MouseEvent) => {
    e?.preventDefault()
    setCourseOpen(true)
  }

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
              <Link href="/portfolio">Portfolio</Link>
              <button onClick={openComingSoon} className="hover:underline">Trading Course</button>
              {isAdmin && <Link href="/admin">Admin</Link>}
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
                <span className="h-8 w-8 rounded-full bg-white/20 grid place-items-center overflow-hidden relative">
                  {data?.user?.image ? (
                    <Image src={data.user.image} alt="avatar" fill className="object-cover" sizes="32px" />
                  ) : (
                    avatarText
                  )}
                </span>
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
            <div className="h-16 w-16 rounded-full bg-white/20 grid place-items-center text-xl mb-3 overflow-hidden relative">
              {data?.user?.image ? (
                <Image src={data.user.image} alt="avatar" fill className="object-cover" sizes="64px" />
              ) : (
                avatarText
              )}
            </div>
            <div className="font-semibold">{displayName}</div>
            <span className="inline-block mt-3 text-xs bg-white/15 rounded-full px-2 py-1">
              Free Tier
            </span>
          </div>

          <ul className="mt-6 grid gap-2">
            <NavItem href="/dashboard" label="Home" icon="🏠" />
            <NavItem href="/chart-tracker" label="Chart Tracker" icon="⚙️" />
            <li>
              <button
                onClick={openComingSoon}
                className="w-full text-left flex items-center gap-3 rounded-xl px-3 py-2 hover:bg-gray-100"
              >
                <span className="w-6 text-center">🎓</span>
                <span>Trading Course</span>
              </button>
            </li>
            <NavItem href="/journal" label="Trading Journal" icon="🗒️" />
            <NavItem href="/strategies" label="Strategy Creator" icon="🧭" />
            <NavItem href="/trade-analyzer" label="Trade Analyzer" icon="📈" />
            <NavItem href="/portfolio" label="Portfolio" icon="💼" />
            {isAdmin && <NavItem href="/admin" label="Admin" icon="🛡️" />}
          </ul>
        </aside>

        <main>{children}</main>
      </div>

      {courseOpen && (
        <div
          className="fixed inset-0 z-[70] bg-black/30 backdrop-blur-[1px] grid place-items-center"
          onClick={() => setCourseOpen(false)}
        >
          <div
            className="w-[440px] max-w-[92vw] rounded-2xl bg-white p-5 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="text-lg font-semibold mb-2">Coming soon…</div>
            <p className="text-sm text-gray-600">
              Our Trading Course is almost ready. Stay tuned! 🚀
            </p>
            <div className="mt-4 text-right">
              <button
                className="rounded-xl bg-black text-white px-4 py-2"
                onClick={() => setCourseOpen(false)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

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

function NavItem({ href, label, icon }: { href: string; label: string; icon: string }) {
  return (
    <li>
      <Link className="flex items-center gap-3 rounded-xl px-3 py-2 hover:bg-gray-100" href={href}>
        <span className="w-6 text-center">{icon}</span>
        <span>{label}</span>
      </Link>
    </li>
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
    <Link href={href} className="flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-gray-100">
      <span className="text-lg">{emoji}</span> {label}
    </Link>
  )
}
