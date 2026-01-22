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

export function BalanceEmptyCard() {
  return (
    <Card className="p-5 rounded-2xl">
      <div className="flex items-start justify-between">
        <div className="text-sm font-medium text-[#64748b]">Current Balance</div>
        <div className="text-sm font-medium text-[#64748b]">24h</div>
      </div>

      <div className="mt-3 text-[36px] leading-none font-semibold text-[#0f172a]">{usd(0)}</div>

      <div className="mt-2 flex gap-3 text-sm text-[#64748b]">
        <span>0.0%</span>
        <span>{usd(0)}</span>
      </div>
    </Card>
  )
}

export function TopPerformersEmptyCard() {
  return (
    <Card className="p-0 rounded-2xl overflow-hidden">
      <div className="px-5 py-4 border-b border-[#eef2f7]">
        <div className="font-semibold text-[#0f172a]">Top Performers</div>
      </div>

      <div className="p-6">
        <div className="rounded-2xl border-2 border-dashed border-[#e5e7eb] p-10 text-center">
          <div className="text-sm text-[#64748b]">
            No assets yet. Top performers will appear here once you add assets.
          </div>
        </div>
      </div>
    </Card>
  )
}

export function EmptyPortfolioCard(props: { onAdd: () => void }) {
  return (
    <Card className="rounded-2xl p-0 overflow-hidden">
      <div className="p-10 flex items-center justify-center min-h-[520px]">
        <div className="max-w-[520px] text-center">
          <div className="mx-auto h-16 w-16 rounded-full bg-[#efe9ff] flex items-center justify-center">
            <span className="text-3xl">💧</span>
          </div>

          <div className="mt-6 text-2xl font-semibold text-[#0f172a]">Your Portfolio is Empty</div>
          <div className="mt-2 text-sm text-[#64748b]">
            Add a new asset with the button below or use search to start tracking your portfolio.
          </div>

          <button
            className="mt-6 px-5 py-3 rounded-[12px] bg-[#2563eb] text-white font-semibold"
            onClick={props.onAdd}
          >
            + Add Asset
          </button>
        </div>
      </div>
    </Card>
  )
}

export function BalanceFilledCard(props: { summary: Summary }) {
  const s = props.summary
  const profitUp = s.profit.total.usd >= 0

  return (
    <Card className="p-5 rounded-2xl">
      <div className="text-sm font-medium text-[#64748b]">Current Balance</div>
      <div className="mt-2 text-[36px] leading-none font-semibold text-[#0f172a]">{usd(s.currentBalanceUsd)}</div>

      <div className="mt-4 grid gap-3 text-sm">
        <div className="flex items-center justify-between">
          <span className="text-[#64748b]">Total Profit</span>
          <span className={cls("font-semibold", profitUp ? "text-emerald-600" : "text-red-600")}>
            {pct(s.profit.total.pct)} <span className="ml-2">{usd(s.profit.total.usd)}</span>
          </span>
        </div>

        <div className="h-px bg-[#eef2f7]" />

        <div className="flex items-center justify-between">
          <span className="text-[#64748b]">Realised Profit</span>
          <span className="font-semibold text-[#0f172a]">{usd(s.profit.realized.usd)}</span>
        </div>

        <div className="flex items-center justify-between">
          <span className="text-[#64748b]">Unrealised Profit</span>
          <span className={cls("font-semibold", s.profit.unrealized.usd >= 0 ? "text-emerald-600" : "text-red-600")}>
            {usd(s.profit.unrealized.usd)}
          </span>
        </div>

        <div className="flex items-center justify-between">
          <span className="text-[#64748b]">Total Invested</span>
          <span className="font-semibold text-[#0f172a]">{usd(s.totalInvestedUsd)}</span>
        </div>
      </div>
    </Card>
  )
}

export function TopPerformersCard(props: { topPerformer: Summary["topPerformer"] }) {
  const t = props.topPerformer
  const up = (t?.profitUsd ?? 0) >= 0

  return (
    <Card className="p-0 rounded-2xl overflow-hidden">
      <div className="px-5 py-4 border-b border-[#eef2f7]">
        <div className="font-semibold text-[#0f172a]">Top Performers</div>
      </div>

      <div className="p-5">
        {!t ? (
          <div className="text-sm text-[#64748b]">—</div>
        ) : (
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-[#f59e0b] text-white flex items-center justify-center font-bold">
                ₿
              </div>
              <div className="grid">
                <div className="font-semibold text-[#0f172a]">{t.symbol}</div>
              </div>
            </div>

            <div className="text-right">
              <div className={cls("font-semibold", up ? "text-emerald-600" : "text-red-600")}>{usd(t.profitUsd)}</div>
              <div className={cls("text-sm", up ? "text-emerald-600" : "text-red-600")}>{pct(t.profitPct)}</div>
            </div>
          </div>
        )}
      </div>
    </Card>
  )
}
