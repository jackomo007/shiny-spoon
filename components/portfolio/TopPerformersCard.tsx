"use client"

import Card from "@/components/ui/Card"
import { usd, pct } from "@/components/portfolio/format"

export default function TopPerformersCard(props: {
  topPerformer: null | { symbol: string; name: string | null; profitUsd: number; profitPct: number | null }
}) {
  const t = props.topPerformer

  return (
    <Card className="p-5">
      <div className="text-lg font-semibold mb-4">Top Performers</div>

      {!t ? (
        <div className="text-gray-400">—</div>
      ) : (
        <div className="flex items-center justify-between rounded-xl bg-slate-50 px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-full bg-orange-500 text-white flex items-center justify-center font-bold">
              ₿
            </div>
            <strong className="text-slate-900">{t.symbol}</strong>
          </div>

          <div className="text-right">
            <div className="font-bold text-emerald-600">{usd(t.profitUsd)}</div>
            <div className="text-xs text-emerald-600">{pct(t.profitPct ?? null)}</div>
          </div>
        </div>
      )}
    </Card>
  )
}
