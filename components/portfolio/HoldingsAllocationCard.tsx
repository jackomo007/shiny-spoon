"use client"

import { useMemo } from "react"
import Card from "@/components/ui/Card"
import { PieChart, Pie, Tooltip, ResponsiveContainer, Cell } from "recharts"
import { usd } from "@/components/portfolio/format"

export type AllocationAssetRow = {
  symbol: string
  name: string | null
  holdingsValueUsd: number
  totalInvestedUsd: number
}

type PieRow = {
  symbol: string
  name: string
  valueUsd: number
  percent: number
  color: string
}

function colorFor(key: string) {
  let h = 0
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) >>> 0
  const hue = h % 360
  return `hsl(${hue} 70% 45%)`
}

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n))
}

export default function HoldingsAllocationCard(props: { assets: AllocationAssetRow[] }) {
  const { totalUsd, pie } = useMemo(() => {
    const base = (props.assets ?? [])
      .map((a) => {
        const v = Number.isFinite(a.holdingsValueUsd) && a.holdingsValueUsd > 0 ? a.holdingsValueUsd : a.totalInvestedUsd
        return {
          symbol: a.symbol,
          name: a.name ?? a.symbol,
          valueUsd: Number.isFinite(v) && v > 0 ? v : 0,
        }
      })
      .filter((a) => a.valueUsd > 0)
      .sort((a, b) => b.valueUsd - a.valueUsd)

    const total = base.reduce((s, r) => s + r.valueUsd, 0)

    const pieRows: PieRow[] =
      total > 0
        ? base.map((r) => ({
            symbol: r.symbol,
            name: r.name,
            valueUsd: r.valueUsd,
            percent: (r.valueUsd / total) * 100,
            color: colorFor(r.symbol),
          }))
        : []

    return { totalUsd: total, pie: pieRows }
  }, [props.assets])

  const hasData = pie.length > 0 && totalUsd > 0

  return (
    <Card className="p-6 rounded-2xl">
      <div className="text-lg font-semibold mb-4">Holdings Allocation</div>

      {!hasData ? (
        <div className="text-sm text-gray-600">No holdings yet.</div>
      ) : (
        <div className="grid gap-4">
          <div className="h-[260px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={pie}
                  dataKey="valueUsd"
                  nameKey="name"
                  innerRadius={72}
                  outerRadius={110}
                  stroke="#fff"
                  strokeWidth={2}
                  isAnimationActive={false}
                >
                  {pie.map((p) => (
                    <Cell key={p.symbol} fill={p.color} />
                  ))}
                </Pie>

                <Tooltip
                  formatter={(_value, _name, item) => {
                    const row = item?.payload as PieRow | undefined
                    const pct = row?.percent ?? 0
                    const safePct = Number.isFinite(pct) ? clamp(pct, 0, 100) : 0
                    const usdValue = row?.valueUsd ?? 0
                    return [`${safePct.toFixed(2)}% · ${usd(usdValue)}`, row?.name ?? "Asset"]
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-4">
            {pie.map((p) => (
              <div key={p.symbol} className="flex items-center gap-2 text-sm text-gray-700">
                <span className="inline-block h-3 w-3 rounded-sm" style={{ background: p.color }} />
                <span className="font-medium">{p.symbol}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </Card>
  )
}
