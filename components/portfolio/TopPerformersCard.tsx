"use client"

import Card from "@/components/ui/Card"
import { usd, pct } from "@/components/portfolio/format"
import { CoinBadge } from "@/components/portfolio/CoinBadge"

export default function TopPerformersCard(props: {
  topPerformer: null | {
    symbol: string
    name: string | null
    iconUrl?: string | null
    profitUsd: number
    profitPct: number | null
  }
}) {
  const t = props.topPerformer

  return (
    <Card className="rounded-[14px] shadow-[0_8px_20px_rgba(0,0,0,0.04)]">
      <div className="text-lg font-semibold mb-3">Top Performers</div>

      {!t ? (
        <div className="text-gray-400">—</div>
      ) : (
        <div className="flex items-center justify-between rounded-[12px] bg-slate-50 px-4 py-[14px]">
          <div className="flex items-center gap-3">
            <CoinBadge symbol={t.symbol} iconUrl={t.iconUrl ?? null} mode="coin" size="md" />
            <div className="grid">
              <strong className="text-slate-900 leading-none">{t.symbol}</strong>
              <span className="text-xs text-slate-500">{t.name ?? ""}</span>
            </div>
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
