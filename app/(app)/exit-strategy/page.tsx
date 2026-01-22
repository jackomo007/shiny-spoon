"use client"

import { useEffect, useMemo, useState } from "react"
import Modal from "@/components/ui/Modal"
import AssetAutocomplete from "@/components/trade-analyzer/AssetAutocomplete"

type StrategyType = "percentage"

type ExitStrategySummary = {
  id: string
  coinSymbol: string
  strategyType: StrategyType
  sellPercent: number
  gainPercent: number
  isActive: boolean

  qtyOpen: number
  entryPriceUsd: number

  currentPriceUsd: number
  currentPriceSource: "binance" | "coingecko" | "db_cache" | "avg_entry"
  currentPriceIsEstimated: boolean

  nextGainPercent: number
  targetPriceUsd: number
  qtyToSell: number
  usdValueToSell: number
  distanceToTargetPercent: number

  status: "pending" | "ready"
}

type ExitStrategyStepRow = {
  gainPercent: number
  targetPriceUsd: number
  plannedQtyToSell: number
  executedQtyToSell: number | null
  proceedsUsd: number | null
  remainingQtyAfter: number
  realizedProfitUsd: number | null
  cumulativeRealizedProfitUsd: number
}

type Details = { summary: ExitStrategySummary; rows: ExitStrategyStepRow[] }

function usd(n: number | null | undefined) {
  const v = typeof n === "number" && !Number.isNaN(n) ? n : 0
  return v.toLocaleString(undefined, { style: "currency", currency: "USD" })
}

function num(n: number, d = 2) {
  if (!Number.isFinite(n)) return "-"
  return n.toLocaleString(undefined, { maximumFractionDigits: d })
}

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n))
}

export default function ExitStrategyPage() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [items, setItems] = useState<ExitStrategySummary[]>([])

  const [addOpen, setAddOpen] = useState(false)
  const [detailsOpen, setDetailsOpen] = useState(false)

  const [details, setDetails] = useState<Details | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const [confirmDelete, setConfirmDelete] = useState<null | { id: string; label: string }>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const [coinSymbol, setCoinSymbol] = useState("ADA")
  const [strategyType, setStrategyType] = useState<StrategyType>("percentage")
  const [sellPercent, setSellPercent] = useState(25)
  const [gainPercent, setGainPercent] = useState(30)

  const [addError, setAddError] = useState<string | null>(null)

  const [simLoading, setSimLoading] = useState(false)
  const [simError, setSimError] = useState<string | null>(null)
  const [simRows, setSimRows] = useState<ExitStrategyStepRow[] | null>(null)
  const [simMeta, setSimMeta] = useState<{ qtyOpen: number; entryPriceUsd: number } | null>(null)

  const [viewSimLoading, setViewSimLoading] = useState(false)
  const [viewSimError, setViewSimError] = useState<string | null>(null)
  const [viewSimRows, setViewSimRows] = useState<ExitStrategyStepRow[] | null>(null)

  const canShowPctFields = useMemo(() => strategyType === "percentage", [strategyType])

  const handleCoinChange = (v: string) => {
    const next = (v ?? "").trim()
    if (!next) return
    setCoinSymbol(next.toUpperCase())
  }

  const load = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch("/api/exit-strategies", { cache: "no-store" })
      if (!res.ok) {
        const j = (await res.json().catch(() => ({} as { error?: string }))) as { error?: string }
        throw new Error(j.error || `HTTP ${res.status}`)
      }
      const json = (await res.json()) as { data: ExitStrategySummary[] }
      setItems(json.data)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [])

  useEffect(() => {
    if (!addOpen) {
      setAddError(null)
      setSimError(null)
      setSimRows(null)
      setSimMeta(null)
      setSimLoading(false)
    }
  }, [addOpen])

  const openDetails = async (id: string) => {
    setSelectedId(id)
    setDetails(null)
    setDetailsOpen(true)
    setError(null)

    setViewSimLoading(false)
    setViewSimError(null)
    setViewSimRows(null)

    try {
      const res = await fetch(`/api/exit-strategies/${encodeURIComponent(id)}`, { cache: "no-store" })
      if (!res.ok) {
        const j = (await res.json().catch(() => ({} as { error?: string }))) as { error?: string }
        throw new Error(j.error || `HTTP ${res.status}`)
      }
      const json = (await res.json()) as { data: Details }
      setDetails(json.data)

      setViewSimLoading(true)
      setViewSimError(null)
      setViewSimRows(null)

      try {
        const simRes = await fetch("/api/exit-strategies/simulate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            coinSymbol: json.data.summary.coinSymbol,
            sellPercent: json.data.summary.sellPercent,
            gainPercent: json.data.summary.gainPercent,
            maxSteps: 10,
          }),
        })

        if (!simRes.ok) {
          const j = (await simRes.json().catch(() => ({} as { error?: string }))) as { error?: string }
          throw new Error(j.error || `HTTP ${simRes.status}`)
        }

        const simJson = (await simRes.json()) as { data: { rows: ExitStrategyStepRow[] } }
        setViewSimRows(simJson.data.rows)
      } catch (simErr) {
        setViewSimError(simErr instanceof Error ? simErr.message : "Failed to simulate")
      } finally {
        setViewSimLoading(false)
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load details")
      setViewSimLoading(false)
    }
  }

  const createStrategy = async () => {
    setError(null)
    setAddError(null)

    try {
      const res = await fetch("/api/exit-strategies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ coinSymbol, strategyType, sellPercent, gainPercent }),
      })

      if (!res.ok) {
        const j = (await res.json().catch(() => ({} as { error?: string }))) as { error?: string }

        if (res.status === 409) {
          setAddError(j.error || "An exit strategy for this coin already exists. Open it in View to see details.")
          return
        }

        throw new Error(j.error || "Operation failed")
      }

      setAddOpen(false)
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to create")
    }
  }

  const simulatePlan = async () => {
    setSimLoading(true)
    setSimError(null)
    setSimRows(null)
    setSimMeta(null)

    try {
      const res = await fetch("/api/exit-strategies/simulate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          coinSymbol,
          sellPercent,
          gainPercent,
          maxSteps: 5,
        }),
      })

      if (!res.ok) {
        const j = (await res.json().catch(() => ({} as { error?: string }))) as { error?: string }
        throw new Error(j.error || `HTTP ${res.status}`)
      }

      const json = (await res.json()) as {
        data: {
          qtyOpen: number
          entryPriceUsd: number
          rows: ExitStrategyStepRow[]
        }
      }

      setSimMeta({ qtyOpen: json.data.qtyOpen, entryPriceUsd: json.data.entryPriceUsd })
      setSimRows(json.data.rows)
    } catch (e) {
      setSimError(e instanceof Error ? e.message : "Failed to simulate")
    } finally {
      setSimLoading(false)
    }
  }

  const requestDelete = (id: string, label: string) => {
    setConfirmDelete({ id, label })
  }

  const confirmDeleteNow = async () => {
    if (!confirmDelete) return
    const { id } = confirmDelete

    setDeletingId(id)
    setError(null)

    try {
      const res = await fetch(`/api/exit-strategies/${encodeURIComponent(id)}`, { method: "DELETE" })
      if (!res.ok && res.status !== 204) {
        const j = (await res.json().catch(() => ({} as { error?: string }))) as { error?: string }
        throw new Error(j.error || `Failed (${res.status})`)
      }

      setConfirmDelete(null)
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to delete")
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Exit Strategy</h1>
          <p className="text-sm text-gray-500">Execution-ready scale-out plans for your portfolio.</p>
        </div>

        <button
          className="px-4 py-2 rounded-xl bg-purple-600 text-white hover:bg-purple-700"
          onClick={() => {
            setAddError(null)
            setAddOpen(true)
          }}
          type="button"
        >
          + Add Strategy
        </button>
      </div>

      {error && <div className="p-4 rounded-xl bg-red-50 text-red-700 border border-red-200">{error}</div>}

      <div className="rounded-2xl border bg-white p-6">
        <div className="text-lg font-semibold mb-4">Your Strategies</div>

        {loading ? (
          <div className="h-[220px] w-full rounded-xl bg-gray-100 animate-pulse" />
        ) : items.length === 0 ? (
          <div className="text-sm text-gray-600">
            No exit strategies yet. Click <b>Add Strategy</b> to create one.
          </div>
        ) : (
          <div className="grid gap-4">
            {items.map((s) => {
              const isReady = s.status === "ready"

              const statusLabel = isReady ? "Ready" : "Pending"
              const statusClasses = isReady ? "bg-purple-100 text-purple-700" : "bg-gray-100 text-gray-700"

              const distance = clamp(s.distanceToTargetPercent, 0, 100)
              const progress = 100 - distance

              return (
                <div key={s.id} className="rounded-2xl border bg-white overflow-hidden">
                  <div className="p-5">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <div className="text-lg font-semibold">{s.coinSymbol}</div>
                        <div className="text-sm text-gray-500">
                          Sell {num(s.sellPercent, 2)}% every {num(s.gainPercent, 2)}% gain
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          className="h-9 px-4 rounded-xl bg-purple-600 text-white text-sm hover:bg-purple-700"
                          onClick={() => void openDetails(s.id)}
                          type="button"
                        >
                          View
                        </button>

                        <button
                          className="h-9 w-10 rounded-xl border bg-white text-gray-600 hover:bg-gray-50 disabled:opacity-50"
                          onClick={() => requestDelete(s.id, s.coinSymbol)}
                          aria-label="Delete strategy"
                          title="Delete"
                          type="button"
                          disabled={deletingId === s.id}
                        >
                          ✕
                        </button>
                      </div>
                    </div>

                    <div className="mt-4 rounded-xl border bg-gray-50 px-4 py-3">
                      <div className="text-sm text-gray-700">
                        Next:{" "}
                        <span className="font-semibold text-gray-900">
                          Sell {num(s.qtyToSell, 8).replace(/\.?0+$/, "")} {s.coinSymbol} ({usd(s.usdValueToSell)}) at $
                          {Number(s.targetPriceUsd).toFixed(3)} (+{num(s.nextGainPercent, 0)}%)
                        </span>
                      </div>
                    </div>

                    <div className="mt-3 flex items-center gap-3 text-sm">
                      <div className="text-gray-600">
                        Distance: <span className="text-gray-900">{num(s.distanceToTargetPercent, 2)}%</span>
                      </div>
                      <span className={`px-2 py-0.5 rounded-full text-xs ${statusClasses}`}>{statusLabel}</span>
                    </div>

                    <div className="mt-3 h-2.5 rounded-full bg-gray-100 overflow-hidden">
                      <div className="h-full rounded-full bg-purple-600" style={{ width: `${progress.toFixed(2)}%` }} />
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {addOpen && (
        <Modal
          open
          widthClass="max-w-5xl"
          onClose={() => setAddOpen(false)}
          title="Add Exit Strategy"
          footer={
            <div className="flex items-center justify-end gap-3">
              <button
                className="rounded-xl border bg-white px-4 py-2 text-sm hover:bg-gray-50 disabled:opacity-50"
                onClick={() => void simulatePlan()}
                type="button"
                disabled={simLoading || !canShowPctFields}
                title="Preview do plano sem salvar"
              >
                {simLoading ? "Simulating…" : "Simulate Scale-Out Plan"}
              </button>

              <button
                className="rounded-xl border bg-white px-4 py-2 text-sm hover:bg-gray-50"
                onClick={() => setAddOpen(false)}
                type="button"
              >
                Cancel
              </button>

              <button
                className="rounded-xl bg-purple-600 text-white px-4 py-2 text-sm hover:bg-purple-700"
                onClick={() => void createStrategy()}
                type="button"
              >
                Save
              </button>
            </div>
          }
        >
          <div className="grid gap-3">
            {addError && (
              <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{addError}</div>
            )}

            <label className="grid gap-1">
              <span className="text-xs text-gray-500">Coin</span>
              <AssetAutocomplete value={coinSymbol} onChange={handleCoinChange} />
            </label>

            <label className="grid gap-1">
              <span className="text-xs text-gray-500">Strategy Type</span>
              <select
                className="w-full rounded-xl border border-gray-200 px-3 py-2"
                value={strategyType}
                onChange={(e) => setStrategyType(e.target.value as StrategyType)}
              >
                <option value="percentage">Percentage Based</option>
              </select>
            </label>

            {canShowPctFields && (
              <>
                <label className="grid gap-1">
                  <span className="text-xs text-gray-500">Sell %</span>
                  <input
                    type="number"
                    className="w-full rounded-xl border border-gray-200 px-3 py-2"
                    value={sellPercent}
                    onChange={(e) => setSellPercent(Number(e.target.value))}
                    min={0}
                    max={100}
                    step={0.01}
                  />
                </label>

                <label className="grid gap-1">
                  <span className="text-xs text-gray-500">Gain Interval %</span>
                  <input
                    type="number"
                    className="w-full rounded-xl border border-gray-200 px-3 py-2"
                    value={gainPercent}
                    onChange={(e) => setGainPercent(Number(e.target.value))}
                    min={0}
                    step={0.01}
                  />
                </label>
              </>
            )}

            {simError && (
              <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{simError}</div>
            )}

            {simRows && (
              <div className="mt-2 rounded-xl border bg-white overflow-x-auto">
                <div className="px-4 py-3 border-b bg-gray-50">
                  <div className="text-sm font-semibold">Simulated Scale-Out Plan</div>
                  <div className="text-xs text-gray-500">
                    Using your current holding/avg entry for <b>{coinSymbol}</b>
                    {simMeta ? (
                      <>
                        {" "}
                        • Entry: <b>{usd(simMeta.entryPriceUsd)}</b> • Open Qty:{" "}
                        <b>{num(simMeta.qtyOpen, 8).replace(/\.?0+$/, "")}</b>
                      </>
                    ) : null}
                  </div>
                </div>

                <table className="w-full text-sm">
                  <thead className="border-b bg-gray-50">
                    <tr className="text-left text-gray-600">
                      <th className="px-4 py-3">Gain</th>
                      <th className="px-4 py-3">Target Price</th>
                      <th className="px-4 py-3">Qty Sold</th>
                      <th className="px-4 py-3">Remaining</th>
                    </tr>
                  </thead>
                  <tbody>
                    {simRows.map((r) => (
                      <tr key={r.gainPercent} className="border-b last:border-b-0">
                        <td className="px-4 py-3">+{num(r.gainPercent, 0)}%</td>
                        <td className="px-4 py-3">{usd(r.targetPriceUsd)}</td>
                        <td className="px-4 py-3">
                          {num(r.plannedQtyToSell, 8).replace(/\.?0+$/, "")} {coinSymbol}
                        </td>
                        <td className="px-4 py-3">
                          {num(r.remainingQtyAfter, 8).replace(/\.?0+$/, "")} {coinSymbol}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </Modal>
      )}

      {confirmDelete && (
        <Modal
          open
          onClose={() => (deletingId ? null : setConfirmDelete(null))}
          title="Delete Exit Strategy"
          footer={
            <div className="flex items-center justify-end gap-3">
              <button
                className="rounded-xl border bg-white px-4 py-2 text-sm hover:bg-gray-50 disabled:opacity-50"
                onClick={() => setConfirmDelete(null)}
                type="button"
                disabled={!!deletingId}
              >
                Cancel
              </button>
              <button
                className="rounded-xl bg-red-600 text-white px-4 py-2 text-sm hover:bg-red-700 disabled:opacity-50"
                onClick={() => void confirmDeleteNow()}
                type="button"
                disabled={!!deletingId}
              >
                {deletingId ? "Deleting…" : "Delete"}
              </button>
            </div>
          }
        >
          <div className="text-sm text-gray-700">
            Are you sure you want to delete the exit strategy for <b>{confirmDelete.label}</b>?
            <div className="mt-2 text-xs text-gray-500">This will also remove its execution history.</div>
          </div>
        </Modal>
      )}

      {detailsOpen && (
        <Modal
          open
          widthClass="max-w-5xl"
          onClose={() => {
            setDetailsOpen(false)
            setSelectedId(null)
            setDetails(null)

            setViewSimLoading(false)
            setViewSimError(null)
            setViewSimRows(null)
          }}
          title={details?.summary ? `${details.summary.coinSymbol} – Scale-Out Plan` : "Loading…"}
          footer={
            <div className="flex items-center justify-end gap-3">
              <button
                className="rounded-xl bg-purple-600 text-white px-4 py-2 text-sm hover:bg-purple-700"
                onClick={() => {
                  setDetailsOpen(false)
                  setSelectedId(null)
                  setDetails(null)

                  setViewSimLoading(false)
                  setViewSimError(null)
                  setViewSimRows(null)
                }}
                type="button"
              >
                Close
              </button>
            </div>
          }
        >
          {!details ? (
            <div className="text-sm text-gray-600">Loading…</div>
          ) : (
            <div className="grid gap-4">
              {/* NEW: Simulated Scale-Out Plan section in View */}
              <div className="rounded-xl border bg-white overflow-x-auto">
                <div className="px-4 py-3 border-b bg-gray-50">
                  <div className="text-sm font-semibold">Simulated Scale-Out Plan</div>
                  <div className="text-xs text-gray-500">Preview of planned steps (independent of executions).</div>
                </div>

                {viewSimError && (
                  <div className="m-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                    {viewSimError}
                  </div>
                )}

                {viewSimLoading ? (
                  <div className="p-4 text-sm text-gray-600">Loading simulation…</div>
                ) : !viewSimRows ? (
                  <div className="p-4 text-sm text-gray-600">No simulation available.</div>
                ) : (
                  <table className="w-full text-sm">
                    <thead className="border-b bg-gray-50">
                      <tr className="text-left text-gray-600">
                        <th className="px-4 py-3">Gain</th>
                        <th className="px-4 py-3">Target Price</th>
                        <th className="px-4 py-3">Qty Sold</th>
                        <th className="px-4 py-3">Remaining</th>
                      </tr>
                    </thead>
                    <tbody>
                      {viewSimRows.map((r) => (
                        <tr key={r.gainPercent} className="border-b last:border-b-0">
                          <td className="px-4 py-3">+{num(r.gainPercent, 0)}%</td>
                          <td className="px-4 py-3">{usd(r.targetPriceUsd)}</td>
                          <td className="px-4 py-3">{num(r.plannedQtyToSell, 8).replace(/\.?0+$/, "")}</td>
                          <td className="px-4 py-3">{num(r.remainingQtyAfter, 8).replace(/\.?0+$/, "")}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          )}
        </Modal>
      )}
    </div>
  )
}
