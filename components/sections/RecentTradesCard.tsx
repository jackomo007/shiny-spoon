"use client"

import { useEffect, useState } from "react"
import Card from "../ui/Card"
import type { journal_entry_status } from "@prisma/client"

type TradeItem = {
  id: string
  asset_name: string
  trade_type: number
  status: journal_entry_status
  trade_datetime: string
}

export default function RecentTradesCard() {
  const [items, setItems] = useState<TradeItem[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancel = false
    ;(async () => {
      try {
        const res = await fetch("/api/metrics/recent-trades", { cache: "no-store" })
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const js: { items?: TradeItem[] } = await res.json()
        if (!cancel) setItems(js.items ?? [])
      } catch {
        if (!cancel) setItems([])
      } finally {
        if (!cancel) setLoading(false)
      }
    })()
    return () => { cancel = true }
  }, [])

  return (
    <Card className="p-0 overflow-hidden">
      <div className="px-6 pt-5 pb-3">
        <div className="text-base font-semibold text-gray-800">Recent trades</div>
      </div>

      <div className="px-6 pb-6">
        {loading ? (
          <div className="space-y-2">
            <div className="h-10 rounded-xl bg-gray-100 animate-pulse" />
            <div className="h-10 rounded-xl bg-gray-100 animate-pulse" />
            <div className="h-10 rounded-xl bg-gray-100 animate-pulse" />
          </div>
        ) : items.length === 0 ? (
          <div className="text-sm text-gray-500">No recent trades</div>
        ) : (
          <ul className="grid gap-2">
            {items.map(r => (
              <li
                key={r.id}
                className="text-sm flex items-center justify-between border rounded-xl px-3 py-2"
              >
                <span>
                  {r.asset_name} — {r.trade_type === 2 ? "Futures" : "Spot"} — {r.status.replace("_", " ")}
                </span>
                <span className="text-gray-500">
                  {new Date(r.trade_datetime).toLocaleString()}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Card>
  )
}
