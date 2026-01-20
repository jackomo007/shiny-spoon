"use client"

import { useEffect, useState } from "react"
import Card from "@/components/ui/Card"
import AddTransactionModal from "@/components/portfolio/AddTransactionModal"
import PortfolioSummaryCards from "@/components/portfolio/PortfolioSummaryCards"
import AssetsTable, { AssetRow } from "@/components/portfolio/AssetsTable"
import TransactionsTable, { TxRow } from "@/components/portfolio/TransactionsTable"
import HoldingsAllocationCard, { AllocationAssetRow } from "@/components/portfolio/HoldingsAllocationCard"

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

  // Adaptador: o card de allocation só precisa (symbol, name, holdingsValueUsd)
  const allocationAssets: AllocationAssetRow[] = (data?.assets ?? []).map((a) => ({
    symbol: a.symbol,
    name: a.name ?? null,
    holdingsValueUsd: a.holdingsValueUsd,
  }))

  return (
    <div className="grid gap-6">
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold">Portfolio</h1>
          <p className="text-sm text-gray-500">Separate view from Journal • Spot holdings only</p>
        </div>

        <div className="flex gap-2">
          <button className="px-3 py-2 rounded-xl bg-gray-900 text-white" onClick={() => setModalOpen(true)}>
            + Add Transaction
          </button>
        </div>
      </div>

      {loading ? (
        <Card className="p-6">
          <div className="h-6 w-48 bg-gray-100 animate-pulse rounded" />
          <div className="h-24 bg-gray-100 animate-pulse rounded mt-4" />
        </Card>
      ) : error ? (
        <Card className="p-6">
          <div className="text-red-600">{error}</div>
        </Card>
      ) : !data ? (
        <Card className="p-6">
          <div className="text-gray-600">No data.</div>
        </Card>
      ) : !hasAssets ? (
        <Card className="p-10">
          <div className="max-w-xl">
            <div className="text-xl font-semibold">Build your portfolio</div>
            <div className="text-sm text-gray-600 mt-2">
              Add your first spot transaction to start tracking Current Balance, Profit and allocations.
            </div>

            <button
              className="mt-6 inline-flex items-center rounded-xl bg-gray-900 px-4 py-2 text-sm font-medium text-white"
              onClick={() => setModalOpen(true)}
            >
              + Add Asset
            </button>

            <div className="mt-6 text-xs text-gray-500">
              Only spot trades are shown here. Your Journal remains the source of truth for all trades.
            </div>
          </div>
        </Card>
      ) : (
        <div className="grid gap-6">
          <PortfolioSummaryCards summary={data.summary} />

          <HoldingsAllocationCard assets={allocationAssets} />

          <AssetsTable assets={data.assets} />
          <TransactionsTable rows={data.transactions} />
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
        <span>© 2025 Maverick AI. All rights reserved.</span>
      </footer>
    </div>
  )
}
