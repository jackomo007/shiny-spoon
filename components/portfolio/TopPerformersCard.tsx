"use client"

import Card from "@/components/ui/Card"
import { usd, pct, cls } from "@/components/portfolio/format"
import { CoinBadge } from "@/components/portfolio/CoinBadge"

export default function TopPerformersCard(props: {
  assets: Array<{
    symbol: string
    name: string | null
    iconUrl: string | null
    currentProfitUsd: number
    currentProfitPct: number | null
  }>
}) {
  const top5 = (props.assets ?? [])
    .slice()
    .sort((a, b) => {
      const ap = a.currentProfitPct
      const bp = b.currentProfitPct

      if (ap != null && bp != null) return bp - ap
      if (ap != null && bp == null) return -1
      if (ap == null && bp != null) return 1
      return (b.currentProfitUsd ?? 0) - (a.currentProfitUsd ?? 0)
    })
    .slice(0, 5)

  return (
    <Card className="rounded-[14px] shadow-[0_8px_20px_rgba(0,0,0,0.04)] p-4">
      <div className="text-lg font-semibold mb-3">Top Performers</div>

      {top5.length === 0 ? (
        <div className="text-gray-400">—</div>
      ) : (
        <div className="grid gap-3">
          {top5.map((t, idx) => {
            const up = (t.currentProfitUsd ?? 0) >= 0

            return (
              <div
                key={`${t.symbol}-${idx}`}
                className="flex items-center justify-between rounded-[12px] bg-slate-50 px-4 py-[14px]"
              >
                <div className="flex items-center gap-3">
                  <CoinBadge symbol={t.symbol} iconUrl={t.iconUrl ?? null} mode="coin" size="md" />
                  <div className="grid">
                    <strong className="text-slate-900 leading-none">{t.symbol}</strong>
                    <span className="text-xs text-slate-500">{t.name ?? ""}</span>
                  </div>
                </div>

                <div className="text-right">
                  <div className={cls("font-bold", up ? "text-emerald-600" : "text-red-600")}>
                    {usd(t.currentProfitUsd)}
                  </div>
                  <div className={cls("text-xs", up ? "text-emerald-600" : "text-red-600")}>
                    {pct(t.currentProfitPct)}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </Card>
  )
}
