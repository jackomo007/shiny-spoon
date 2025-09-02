"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"

type AccountType = "crypto" | "stock" | "forex"

type AccountRow = {
  id: string
  name: string | null
  type: AccountType
  created_at?: string | null
}

type ApiListResponse = {
  items: AccountRow[]
  activeId: string | null
}

type Props = { open?: boolean; onClose: () => void }

export default function AccountSwitcher({ open, onClose }: Props) {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [items, setItems] = useState<AccountRow[]>([])
  const [activeId, setActiveId] = useState<string | null>(null)

  async function load() {
    try {
      setLoading(true)
      setError(null)
      const r = await fetch("/api/accounts", { cache: "no-store" })
      if (!r.ok) throw new Error(await r.text())
      const data = (await r.json()) as ApiListResponse
      setItems(Array.isArray(data.items) ? data.items : [])
      setActiveId(data.activeId ?? null)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load accounts")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (typeof open === "boolean" && !open) return
    load()
  }, [open])

  if (typeof open === "boolean" && !open) return null

  async function switchAccount(id: string) {
    try {
      const r = await fetch("/api/accounts/switch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accountId: id }),
      })
      if (!r.ok) {
        let msg = "Failed to switch account"
        try {
          const data = await r.json()
          if (data?.error) msg = String(data.error)
        } catch {
        }
        throw new Error(msg)
      }
      setActiveId(id)
      onClose()
      router.refresh()
    } catch (e) {
      alert(e instanceof Error ? e.message : "Failed to switch account")
    }
  }

  return (
    <div className="grid gap-3">
      <div className="text-sm text-gray-500">Accounts</div>

      {loading ? (
        <div className="text-sm text-gray-500 py-6">Loading…</div>
      ) : error ? (
        <div className="text-sm text-red-600 py-6">{error}</div>
      ) : items.length === 0 ? (
        <div className="text-sm text-gray-500 py-6">No accounts</div>
      ) : (
        items.map((acc) => {
          const isActive = acc.id === activeId
          return (
            <button
              key={acc.id}
              onClick={() => switchAccount(acc.id)}
              className={`w-full text-left rounded-2xl border p-4 hover:bg-gray-50 transition ${
                isActive ? "border-primary/60 bg-primary/5" : "border-gray-200"
              }`}
            >
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-medium">{acc.name ?? "Untitled account"}</div>
                  <div className="text-xs text-gray-500 mt-0.5">{acc.type.toUpperCase()}</div>
                </div>
                {isActive && (
                  <span className="text-xs rounded-full px-2 py-1 bg-green-100 text-green-700">
                    Active
                  </span>
                )}
              </div>
            </button>
          )
        })
      )}

      <div className="pt-2">
        <a
          href="/profile"
          className="inline-flex items-center gap-2 text-sm text-primary hover:underline"
          onClick={onClose}
        >
          Manage accounts
        </a>
      </div>
    </div>
  )
}
