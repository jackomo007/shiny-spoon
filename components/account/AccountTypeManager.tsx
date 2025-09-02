"use client"

import { useEffect, useState } from "react"

type T = "crypto" | "stock" | "forex"
type Row = { id: string; type: T; name: string | null }

export default function AccountTypeManager() {
  const [rows, setRows] = useState<Row[]>([])
  const [busy, setBusy] = useState<T | null>(null)
  const active = new Set(rows.map(r => r.type))

  async function load() {
    const r = await fetch("/api/accounts/types", { cache: "no-store" })
    const data = await r.json()
    setRows(data.items as Row[])
  }

  useEffect(() => { load() }, [])

  async function toggle(t: T) {
    if (t === "crypto") return 
    setBusy(t)
    try {
      if (active.has(t)) {
        await fetch("/api/accounts/types", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ type: t }),
        })
      } else {
        await fetch("/api/accounts/types", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ type: t }),
        })
      }
      await load()
    } finally {
      setBusy(null)
    }
  }

  const Tile = ({ t, locked = false }: { t: T; locked?: boolean }) => {
    const on = active.has(t)
    return (
      <button
        type="button"
        disabled={locked || !!busy}
        onClick={() => toggle(t)}
        className={`rounded-2xl border p-4 text-left hover:bg-gray-50 ${on ? "border-primary" : "border-gray-200"} ${locked ? "opacity-60 cursor-not-allowed" : ""}`}
      >
        <div className="text-sm text-gray-500">{t.toUpperCase()}</div>
        <div className="mt-1 font-semibold">
          {t === "crypto" ? "Crypto (required)" : t === "stock" ? "Stock" : "Forex"}
        </div>
        <div className="mt-2">
          <input type="checkbox" readOnly checked={on} />{" "}
          <span className="text-sm">{locked ? "Always on" : on ? "Enabled" : "Enable"}</span>
        </div>
      </button>
    )
  }

  return (
    <div className="grid gap-3">
      <div className="text-sm text-gray-600">Manage account types</div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Tile t="crypto" locked />
        <Tile t="stock" />
        <Tile t="forex" />
      </div>
    </div>
  )
}
