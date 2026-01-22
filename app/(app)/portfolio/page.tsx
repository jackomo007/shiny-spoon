"use client"

import { useEffect, useState } from "react"
import AddTransactionModal from "@/components/portfolio/AddTransactionModal"
import PortfolioSummaryCards from "@/components/portfolio/PortfolioSummaryCards" // você pode remover depois, se não quiser os 3 cards
import AssetsTable, { AssetRow } from "@/components/portfolio/AssetsTable"
import TransactionsTable, { TxRow } from "@/components/portfolio/TransactionsTable"
import HoldingsAllocationCard, { AllocationAssetRow } from "@/components/portfolio/HoldingsAllocationCard"
import TopPerformersCard from "@/components/portfolio/TopPerformersCard"
import Card from "@/components/ui/Card"
import { usd, pct } from "@/components/portfolio/format"

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

type PortfolioApiRes = {
  summary: Summary
  assets: AssetRow[]
  transactions: TxRow[]
}

function BalanceCard(props: { summary: Summary }) {
  const s = props.summary
  const profitUp = s.profit.total.usd >= 0

  return (
    <Card className="p-5">
      <div className="flex items-center justify-between mb-3">
        <div className="text-slate-400 font-medium">Current Balance</div>
        <div className="text-slate-400 font-medium">24h</div>
      </div>

      <div className="text-4xl font-bold tracking-tight">{usd(s.currentBalanceUsd)}</div>

      <div className="mt-4 border-t pt-4 space-y-3 text-sm">
        <div className="flex items-center justify-between">
          <div className="text-slate-400">Total Profit</div>
          <div className={`font-semibold ${profitUp ? "text-emerald-600" : "text-red-600"}`}>
            {pct(s.profit.total.pct)} {usd(s.profit.total.usd)}
          </div>
        </div>

        <div className="flex items-center justify-between">
          <div className="text-slate-400">Realised Profit</div>
          <div className="font-semibold">{usd(s.profit.realized.usd)}</div>
        </div>

        <div className="flex items-center justify-between">
          <div className="text-slate-400">Unrealised Profit</div>
          <div className="font-semibold text-emerald-600">{usd(s.profit.unrealized.usd)}</div>
        </div>

        <div className="flex items-center justify-between">
          <div className="text-slate-400">Total Invested</div>
          <div className="font-semibold">{usd(s.totalInvestedUsd)}</div>
        </div>
      </div>
    </Card>
  )
}

export default function PortfolioPage() {
  const [data, setData] = useState<PortfolioApiRes | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [modalOpen, setModalOpen] = useState(false)

  async function load() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch("/api/portfolio", { cache: "no-store" })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const j = (await res.json()) as PortfolioApiRes
      setData(j)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [])

  const hasAssets = (data?.assets?.length ?? 0) > 0

  const allocationAssets: AllocationAssetRow[] = (data?.assets ?? []).map((a) => ({
    symbol: a.symbol,
    name: a.name ?? null,
    holdingsValueUsd: a.holdingsValueUsd,
  }))

  return (
    <div className="grid gap-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-full bg-cyan-300 text-sky-700 font-bold flex items-center justify-center">
            M
          </div>
          <div className="text-xl font-semibold">Main Portfolio</div>
        </div>

        <div className="flex gap-3">
          <button className="px-4 py-2 rounded-xl bg-blue-600 text-white" onClick={() => setModalOpen(true)}>
            + Add Asset
          </button>
        </div>
      </div>

      {loading ? (
        <Card className="p-6">Loading…</Card>
      ) : error ? (
        <Card className="p-6 text-red-600">{error}</Card>
      ) : !data ? (
        <Card className="p-6">No data.</Card>
      ) : !hasAssets ? (
        <Card className="p-10">
          <div className="max-w-xl">
            <div className="text-xl font-semibold">Your Portfolio is Empty</div>
            <div className="text-sm text-gray-600 mt-2">
              Add a new asset with the button below or use search to start tracking your portfolio.
            </div>

            <button
              className="mt-6 inline-flex items-center rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium text-white"
              onClick={() => setModalOpen(true)}
            >
              + Add Asset
            </button>
          </div>
        </Card>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
          <div className="grid gap-6">
            <BalanceCard summary={data.summary} />
            <TopPerformersCard topPerformer={data.summary.topPerformer} />
          </div>

          <div className="grid gap-6">
            <HoldingsAllocationCard assets={allocationAssets} />
            <AssetsTable assets={data.assets} />
            <TransactionsTable rows={data.transactions} />
          </div>
        </div>
      )}

      <AddTransactionModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onDone={async () => {
          setModalOpen(false)
          await load()
        }}
      />

      <footer className="text-xs text-gray-500 py-6 flex items-center gap-6">
        <span>© 2025 Stakk AI. All rights reserved.</span>
      </footer>
    </div>
  )
}
