"use client"

import { useMemo } from "react"
import Card from "@/components/ui/Card"
import { PieChart, Pie, Tooltip, ResponsiveContainer, Cell, Legend } from "recharts"
import { usd } from "@/components/portfolio/format"

export type AllocationAssetRow = {
  symbol: string
  name: string | null
  holdingsValueUsd: number
}

type PieRow = {
  name: string
  symbol: string
  valueUsd: number
  percent: number
}

function colorFor(name: string) {
  let h = 0
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0
  const hue = h % 360
  return `hsl(${hue} 70% 50%)`
}

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n))
}

export default function HoldingsAllocationCard(props: { assets: AllocationAssetRow[] }) {
  const { assets } = props

  const { totalHoldingsUsd, pie } = useMemo(() => {
    const rows = (assets ?? [])
      .filter((a) => Number.isFinite(a.holdingsValueUsd) && a.holdingsValueUsd > 0)
      .sort((a, b) => b.holdingsValueUsd - a.holdingsValueUsd)

    const total = rows.reduce((s, r) => s + r.holdingsValueUsd, 0)

    const pieRows: PieRow[] =
      total > 0
        ? rows.map((r) => ({
            symbol: r.symbol,
            name: r.name ?? r.symbol,
            valueUsd: r.holdingsValueUsd,
            percent: (r.holdingsValueUsd / total) * 100,
          }))
        : []

    return { totalHoldingsUsd: total, pie: pieRows }
  }, [assets])

  const hasData = pie.length > 0 && totalHoldingsUsd > 0

  return (
    <Card className="p-6">
      <div className="text-lg font-semibold mb-4">Holdings Allocation</div>

      {!hasData ? (
        <div className="text-sm text-gray-600">No holdings yet.</div>
      ) : (
        <div className="h-[260px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={pie}
                dataKey="percent"
                nameKey="name"
                innerRadius={60}
                outerRadius={95}
                stroke="#fff"
                strokeWidth={2}
              >
                {pie.map((p) => (
                  <Cell key={p.symbol} fill={colorFor(p.symbol)} />
                ))}
              </Pie>

              <Legend />

              <Tooltip
                formatter={(value, _name, item) => {
                  const row = item?.payload as PieRow | undefined
                  const pct = typeof value === "number" ? value : Number(value)
                  const safePct = Number.isFinite(pct) ? clamp(pct, 0, 100) : 0
                  const usdValue = totalHoldingsUsd * (safePct / 100)

                  // estilo similar ao mock: "Bitcoin: 25% · $12,345"
                  return [`${safePct.toFixed(2)}% · ${usd(usdValue)}`, row?.name ?? "Asset"]
                }}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
      )}
    </Card>
  )
}
