"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import Card from "@/components/ui/Card"

type AccountRow = {
  id: string
  name: string | null
  type: "crypto" | "stock" | "forex"
  created_at: string | Date
}

export default function AccountSwitcher({ onClose }: { onClose?: () => void }) {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [items, setItems] = useState<AccountRow[]>([])
  const [active, setActive] = useState<string | null>(null)

  async function load() {
    try {
      setLoading(true)
      setError(null)
      const r = await fetch("/api/accounts", { cache: "no-store" })
      if (!r.ok) throw new Error(await r.text())
      const payload = (await r.json()) as { accounts: AccountRow[]; active: string | null }
      setItems(Array.isArray(payload.accounts) ? payload.accounts : [])
      setActive(payload.active ?? null)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load accounts")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  async function select(accountId: string) {
    try {
      const r = await fetch("/api/accounts/select", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accountId }),
      })
      if (!r.ok) throw new Error(await r.text())
      onClose?.()
      router.refresh() // troca escopo nos dados
    } catch (e) {
      alert(e instanceof Error ? e.message : "Failed to switch account")
    }
  }

  return (
    <div className="grid gap-3">
      <div className="text-sm text-gray-500 px-1">Accounts</div>

      {loading ? (
        <div className="text-sm text-gray-500 p-3">Loading…</div>
      ) : error ? (
        <div className="text-sm text-red-600 p-3">{error}</div>
      ) : items.length === 0 ? (
        <div className="text-sm text-gray-500 py-4 px-1">No accounts</div>
      ) : (
        items.map(acc => (
          <Card
            key={acc.id}
            className={`cursor-pointer hover:bg-gray-50 border ${
              active === acc.id ? "border-primary" : "border-transparent"
            }`}
            onClick={() => select(acc.id)}
          >
            <div className="flex items-center justify-between">
              <div>
                <div className="font-medium">{acc.name ?? "Untitled"}</div>
                <div className="text-xs text-gray-500">{acc.type.toUpperCase()}</div>
              </div>
              {active === acc.id && <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full">Active</span>}
            </div>
          </Card>
        ))
      )}
    </div>
  )
}
