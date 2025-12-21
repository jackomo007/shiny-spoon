"use client"

import { useEffect, useMemo, useState } from "react"
import Card from "@/components/ui/Card"
import { Table, Th, Tr, Td } from "@/components/ui/Table"
import { PieChart, Pie, Legend, Tooltip, ResponsiveContainer, Cell } from "recharts"
import { useRouter } from "next/navigation"
import Modal from "@/components/ui/Modal"
import { MoneyInputStandalone } from "@/components/form/MaskedFields"
import type React from "react"

type Item = {
  symbol: string
  amount: number
  avgEntryPriceUsd: number
  currentPriceUsd: number
  purchaseValueUsd: number
  valueUsd: number
  percent: number
}

type PortfolioRes = {
  totalValueUsd: number
  totalInvestedUsd: number
  cashUsd: number
  items: Item[]
}

function usd(n: number | null | undefined) {
  const value = typeof n === "number" && !Number.isNaN(n) ? n : 0
  return value.toLocaleString(undefined, { style: "currency", currency: "USD" })
}

const colorFor = (name: string) => {
  let h = 0
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0
  const hue = h % 360
  return `hsl(${hue} 70% 50%)`
}

const dotColor = (sym: string) => colorFor(sym)

export default function PortfolioPage() {
  const [data, setData] = useState<PortfolioRes | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  const [cashModal, setCashModal] = useState<null | { mode: "add" | "edit"; currentAmount?: number }>(null)

  const load = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch("/api/portfolio", { cache: "no-store" })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const json = (await res.json()) as PortfolioRes
      setData(json)
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to load"
      setError(message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [])

  const rows: Item[] = useMemo(() => {
    if (!data) return []

    const base = data.items ?? []
    const cashVal = data.cashUsd ?? 0
    const total = data.totalValueUsd ?? 0

    const existingCash = base.find((i) => i.symbol === "CASH") ?? null
    const others = base.filter((i) => i.symbol !== "CASH")

    let cashItem: Item | null = null
    if (existingCash) {
      cashItem = existingCash as Item
    } else if (cashVal > 0) {
      const percent = total > 0 ? (cashVal / total) * 100 : 0
      cashItem = {
        symbol: "CASH",
        amount: cashVal,
        avgEntryPriceUsd: 1,
        currentPriceUsd: 1,
        purchaseValueUsd: cashVal,
        valueUsd: cashVal,
        percent,
      }
    }

    return cashItem ? [cashItem, ...others] : others
  }, [data])

  const pieData = useMemo(
    () =>
      rows.map((i) => ({
        name: i.symbol,
        percent: Number(i.percent.toFixed(6)),
      })),
    [rows]
  )

  const handleAddAsset = () => {
    const qs = new URLSearchParams({
      from: "portfolio",
      open_spot_trade_modal: "1",
    })
    router.push(`/journal?${qs.toString()}`)
  }

  const handleAddCash = () => {
    setCashModal({ mode: "add" })
  }

  const handleEditAsset = (item: Item) => {
    if (item.symbol === "CASH") {
      setCashModal({ mode: "edit", currentAmount: item.amount })
      return
    }

    const qs = new URLSearchParams({
      from: "portfolio",
      asset_name: item.symbol,
      open_spot_trade_modal: "1",
    })
    router.push(`/journal?${qs.toString()}`)
  }

  return (
    <div className="grid gap-6">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Portfolio Manager</h1>
          <p className="text-sm text-gray-500">
            View your open spot positions at a glance
          </p>
        </div>

        <div className="flex gap-2">
          <button
            className="px-3 py-2 rounded-xl bg-gray-900 text-white"
            onClick={handleAddAsset}
          >
            + Add Asset
          </button>

          {!rows.some((r) => r.symbol === "CASH") && (
            <button
              className="px-3 py-2 rounded-xl bg-emerald-600 text-white"
              onClick={handleAddCash}
            >
              + Add Cash
            </button>
          )}
        </div>
      </div>

      <Card className="p-0">
        {loading ? (
          <div className="h-[360px] w-full rounded-xl bg-gray-100 animate-pulse m-6" />
        ) : error ? (
          <div className="p-6 text-red-600">{error}</div>
        ) : !data || rows.length === 0 ? (
          <div className="p-6 text-sm text-gray-600">
            You don&apos;t have any open spot trades yet.
            <button
              className="ml-2 inline-flex items-center rounded-xl bg-gray-900 px-3 py-1.5 text-xs font-medium text-white"
              onClick={handleAddAsset}
            >
              Add your first asset
            </button>
          </div>
        ) : (
          <div className="p-6">
            <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
              <div className="grid gap-1">
                <div className="text-lg font-semibold">
                  Total Portfolio Value: {usd(data.totalValueUsd)}
                </div>
                <div className="text-sm text-gray-600">
                  Total Amount Invested: <span className="font-medium">{usd(data.totalInvestedUsd)}</span>
                </div>
              </div>

              <div className="text-sm text-gray-600">
                Cash: <span className="font-medium">{usd(data.cashUsd)}</span>
              </div>
            </div>

            <div className="h-[400px] rounded-xl border bg-white mb-6">
              <div className="px-4 pt-3 font-medium">Allocation (Open Spot Trades)</div>
              <div className="h-[320px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      dataKey="percent"
                      nameKey="name"
                      data={pieData}
                      outerRadius={110}
                      label
                      stroke="#fff"
                      strokeWidth={2}
                    >
                      {pieData.map((entry) => (
                        <Cell key={entry.name} fill={dotColor(entry.name)} />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="rounded-xl bg-white">
              <Table>
                <thead>
                  <tr>
                    <Th>Asset</Th>
                    <Th>Asset Amount</Th>
                    <Th>Average Entry Price</Th>
                    <Th>Current Price</Th>
                    <Th>Purchase Value</Th>
                    <Th>Current Value</Th>
                    <Th>% Port.</Th>
                    <Th className="w-40">
                      <div className="flex justify-end pr-1">
                        Actions
                      </div>
                    </Th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((i) => (
                    <Tr key={i.symbol}>
                      <Td className="font-medium">
                        <span
                          className="inline-block mr-2 h-2.5 w-2.5 rounded-full align-middle"
                          style={{ background: dotColor(i.symbol) }}
                        />
                        {i.symbol}
                      </Td>
                      <Td>{i.amount.toFixed(8).replace(/\.?0+$/, "")}</Td>
                      <Td>{usd(i.avgEntryPriceUsd)}</Td>
                      <Td>{usd(i.currentPriceUsd)}</Td>
                      <Td>{usd(i.purchaseValueUsd)}</Td>
                      <Td>{usd(i.valueUsd)}</Td>
                      <Td>{i.percent.toFixed(2)}%</Td>
                      <Td className="w-40">
                        <div className="flex justify-center">
                          <button
                            className="inline-flex items-center h-9 px-4 rounded-xl bg-gray-900 text-white text-sm"
                            onClick={() => handleEditAsset(i)}
                          >
                            {i.symbol === "CASH" ? "Edit Cash" : "Edit in Journal"}
                          </button>
                        </div>
                      </Td>
                    </Tr>
                  ))}
                </tbody>
              </Table>
            </div>
          </div>
        )}
      </Card>

      {cashModal && (
        <CashModal
          mode={cashModal.mode}
          currentAmount={cashModal.currentAmount}
          onClose={() => setCashModal(null)}
          onDone={async () => {
            setCashModal(null)
            await load()
          }}
        />
      )}

      <footer className="text-xs text-gray-500 py-6 flex items-center gap-6">
        <span>© 2025 Maverick AI. All rights reserved.</span>
      </footer>
    </div>
  )
}

function CashModal(props: {
  mode: "add" | "edit"
  currentAmount?: number
  onClose: () => void
  onDone: () => Promise<void>
}) {
  const [amountRaw, setAmountRaw] = useState<string>(
    props.mode === "edit" && props.currentAmount != null
      ? props.currentAmount.toString()
      : ""
  )
  const [busy, setBusy] = useState(false)

  const amountNum = amountRaw === "" ? 0 : Number(amountRaw)
  const title = props.mode === "add" ? "Add Cash" : "Edit Cash"

  const canSave = !busy

  return (
    <Modal
      open
      onClose={props.onClose}
      title={title}
      footer={
        <div className="flex items-center justify-end gap-3">
          <button
            className="rounded-xl bg-gray-100 px-4 py-2 text-sm hover:bg-gray-200"
            onClick={props.onClose}
          >
            Cancel
          </button>
          <button
            className="rounded-xl bg-gray-900 text-white px-4 py-2 text-sm disabled:opacity-50"
            disabled={!canSave}
            onClick={async () => {
              try {
                setBusy(true)

                const res = await fetch("/api/portfolio/cash", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    amountUsd: amountNum,
                  }),
                })

                if (!res.ok) {
                  const j = await res.json().catch(() => ({} as { error?: string }))
                  throw new Error(j?.error || "Operation failed")
                }

                await props.onDone()
              } catch (err) {
                const msg = err instanceof Error ? err.message : "Failed"
                // eslint-disable-next-line no-alert
                alert(msg)
              } finally {
                setBusy(false)
              }
            }}
          >
            Save
          </button>
        </div>
      }
    >
      <div className="grid gap-3">
        <label className="grid gap-1">
          <span className="text-xs text-gray-500">Amount (USD)</span>
          <MoneyInputStandalone
            valueRaw={amountRaw}
            onChangeRaw={setAmountRaw}
            placeholder="0"
            className="w-full rounded-xl border border-gray-200 px-3 py-2"
          />
        </label>
      </div>
    </Modal>
  )
}
