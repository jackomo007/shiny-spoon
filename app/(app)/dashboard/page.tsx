"use client"

import { useEffect, useState } from "react"
import AnnouncementBar from "@/components/sections/AnnouncementBar"
import EarningsChart, { Point } from "@/components/charts/EarningsChart"
import Card from "@/components/ui/Card"
import RecentTradesCard from "@/components/sections/RecentTradesCard"

const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"]

export default function DashboardPage() {
  const [earnings, setEarnings] = useState<Point[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch("/api/metrics/earnings", { cache: "no-store" })
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const data: { items: { month: string; earnings: number }[] } = await res.json()

        const pts: Point[] = data.items.map(({ month, earnings }) => {
          const m = Number(month.slice(5, 7)) - 1
          return { name: MONTHS[m] ?? month, value: earnings }
        })

        if (!cancelled) setEarnings(pts)
      } catch {
        if (!cancelled) setEarnings([])
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [])

  return (
    <div className="grid gap-6">
      <AnnouncementBar />

      <Card>
        <div className="text-lg font-semibold mb-4">Earnings</div>
        {loading ? (
          <div className="h-[220px] w-full rounded-xl bg-gray-100 animate-pulse" />
        ) : (
          <EarningsChart data={earnings} />
        )}
      </Card>

      <div className="grid gap-6">
        <RecentTradesCard />
      </div>

      <footer className="text-xs text-gray-500 py-6 flex items-center gap-6">
        <span>© 2025 Maverick AI. All rights reserved.</span>
        <a href="#" className="hover:underline">Support</a>
        <a href="#" className="hover:underline">Terms</a>
        <a href="#" className="hover:underline">Privacy</a>
      </footer>
    </div>
  )
}
