"use client"

import Card from "@/components/ui/Card"
import { usd, pct, cls } from "@/components/portfolio/format"

type Summary = {
  currentBalanceUsd: number
  totalInvestedUsd: number
  profit: {
    realized: { usd: number }
    unrealized: { usd: number }
    total: { usd: number; pct: number }
  }
  portfolio24h: { pct: number; usd: number }
  topPerformer: null | { symbol: string; name: string | null; profitUsd: number; profitPct: number | null }
}

export default function PortfolioSummaryCards(props: { summary: Summary }) {
  const s = props.summary
  const profitUp = s.profit.total.usd >= 0
  const dayUp = s.portfolio24h.usd >= 0

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <Card className="p-5">
        <div className="text-xs text-gray-500">Current Balance</div>
        <div className="text-2xl font-semibold mt-1">{usd(s.currentBalanceUsd)}</div>
        <div className="text-sm text-gray-600 mt-2">
          24h:{" "}
          <span className={cls("font-medium", dayUp ? "text-emerald-600" : "text-red-600")}>
            {usd(s.portfolio24h.usd)} ({pct(s.portfolio24h.pct)})
          </span>
        </div>
      </Card>

      <Card className="p-5">
        <div className="text-xs text-gray-500">Total Profit</div>
        <div className={cls("text-2xl font-semibold mt-1", profitUp ? "text-emerald-600" : "text-red-600")}>
          {usd(s.profit.total.usd)} ({pct(s.profit.total.pct)})
        </div>
        <div className="mt-2 grid gap-1 text-sm text-gray-600">
          <div>
            Realised: <span className="font-medium">{usd(s.profit.realized.usd)}</span>
          </div>
          <div>
            Unrealised: <span className="font-medium">{usd(s.profit.unrealized.usd)}</span>
          </div>
        </div>
      </Card>

      <Card className="p-5">
        <div className="text-xs text-gray-500">Top Performer</div>
        {s.topPerformer ? (
          <>
            <div className="text-lg font-semibold mt-1">{s.topPerformer.symbol}</div>
            <div className="text-sm text-gray-600">
              Profit:{" "}
              <span className="font-medium">
                {usd(s.topPerformer.profitUsd)} ({pct(s.topPerformer.profitPct ?? null)})
              </span>
            </div>
          </>
        ) : (
          <div className="text-sm text-gray-600 mt-2">—</div>
        )}
        <div className="text-xs text-gray-400 mt-2">Total Invested: {usd(s.totalInvestedUsd)}</div>
      </Card>
    </div>
  )
}
