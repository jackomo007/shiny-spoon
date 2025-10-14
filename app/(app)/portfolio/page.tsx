"use client"

import { useEffect, useMemo, useState } from "react"
import Card from "@/components/ui/Card"
import Modal from "@/components/ui/Modal"
import { Table, Th, Tr, Td } from "@/components/ui/Table"
import { PieChart, Pie, Legend, Tooltip, ResponsiveContainer, Cell } from "recharts"

type Item = {
  symbol: string
  amount: number
  priceUsd: number
  valueUsd: number
  percent: number
  canDelete: boolean
}

type PortfolioRes = {
  totalValueUsd: number
  cashUsd: number
  items: Item[]
}

function usd(n: number) {
  return n.toLocaleString(undefined, { style: "currency", currency: "USD" })
}
const colorFor = (name: string) => {
  let h = 0
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0
  const hue = h % 360
  return `hsl(${hue} 70% 50%)`
}
const dotColor = (sym: string) => (sym === "CASH" ? "#9CA3AF" : colorFor(sym))

export default function PortfolioPage() {
  const [data, setData] = useState<PortfolioRes | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [showAddAsset, setShowAddAsset] = useState(false)
  const [showCash, setShowCash] = useState<null | { kind: "deposit" | "withdraw" }>(null)
  const [trade, setTrade] = useState<null | { symbol: string; type: "buy" | "sell" }>(null)

  const [infoOpen, setInfoOpen] = useState(false)
  const [infoTitle, setInfoTitle] = useState<string>("")
  const [infoMsg, setInfoMsg] = useState<string>("")

  const [confirmOpen, setConfirmOpen] = useState(false)
  const [deleteSymbol, setDeleteSymbol] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)

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

  const pieData = useMemo(
    () =>
      (data?.items ?? []).map((i) => ({
        name: i.symbol,
        percent: Number(i.percent.toFixed(6)),
      })),
    [data]
  )

  const askDelete = (symbol: string) => {
    setDeleteSymbol(symbol)
    setConfirmOpen(true)
  }

  const confirmDelete = async () => {
    if (!deleteSymbol) return
    try {
      setDeleting(true)
      const res = await fetch(`/api/portfolio/${deleteSymbol}`, { method: "DELETE" })
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        throw new Error(j?.error || "Delete failed")
      }
      setConfirmOpen(false)
      setDeleteSymbol(null)
      await load()
      showInfo("Deleted", `${deleteSymbol} removed from portfolio.`)
    } catch (err) {
      showInfo("Error", err instanceof Error ? err.message : "Delete failed")
    } finally {
      setDeleting(false)
    }
  }

  function showInfo(title: string, msg: string) {
    setInfoTitle(title)
    setInfoMsg(msg)
    setInfoOpen(true)
  }

  return (
    <div className="grid gap-6">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Portfolio</h1>
          <p className="text-sm text-gray-500">Build and manage your spot portfolio</p>
        </div>
        <div className="flex gap-2">
          <button className="px-3 py-2 rounded-xl bg-gray-900 text-white" onClick={() => setShowAddAsset(true)}>
            + Add Asset
          </button>
          <button className="px-3 py-2 rounded-xl bg-emerald-600 text-white" onClick={() => setShowCash({ kind: "deposit" })}>
            + Add Cash
          </button>
          <button className="px-3 py-2 rounded-xl bg-rose-600 text-white" onClick={() => setShowCash({ kind: "withdraw" })}>
            Withdraw
          </button>
        </div>
      </div>

      <Card className="p-0">
        {loading ? (
          <div className="h-[360px] w-full rounded-xl bg-gray-100 animate-pulse m-6" />
        ) : error ? (
          <div className="p-6 text-red-600">{error}</div>
        ) : (
          <div className="p-6">
            <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
              <div className="text-lg font-semibold">Total Portfolio Value: {usd(data!.totalValueUsd)}</div>
              <div className="text-sm text-gray-600">
                Cash: <span className="font-medium">{usd(data!.cashUsd)}</span>
              </div>
            </div>

            <div className="h-[320px] rounded-xl border bg-white mb-6">
              <div className="px-4 pt-3 font-medium">Allocation</div>
              <div className="h-[280px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie dataKey="percent" nameKey="name" data={pieData} outerRadius={110} label stroke="#fff" strokeWidth={2}>
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
                    <Th>Amount</Th>
                    <Th>Price</Th>
                    <Th>Value</Th>
                    <Th>% Port.</Th>
                    <Th className="text-right">Actions</Th>
                  </tr>
                </thead>
                <tbody>
                  {(data?.items ?? []).map((i) => (
                    <Tr key={i.symbol}>
                      <Td className="font-medium">
                        <span
                          className="inline-block mr-2 h-2.5 w-2.5 rounded-full align-middle"
                          style={{ background: dotColor(i.symbol) }}
                        />
                        {i.symbol}
                      </Td>
                      <Td>{i.amount.toFixed(8).replace(/\.?0+$/, "")}</Td>
                      <Td>{usd(i.priceUsd)}</Td>
                      <Td>{usd(i.valueUsd)}</Td>
                      <Td>{i.percent.toFixed(2)}%</Td>
                      <Td className="text-right">
                        <div className="inline-flex gap-2">
                          <button
                            className="px-2 py-1 rounded-lg bg-emerald-600 text-white disabled:opacity-50"
                            disabled={i.symbol === "CASH"}
                            onClick={() => setTrade({ symbol: i.symbol, type: "buy" })}
                          >
                            Buy
                          </button>
                          <button
                            className="px-2 py-1 rounded-lg bg-rose-600 text-white disabled:opacity-50"
                            disabled={i.symbol === "CASH" || i.amount <= 0}
                            onClick={() => setTrade({ symbol: i.symbol, type: "sell" })}
                          >
                            Sell
                          </button>
                          <button
                            className="px-2 py-1 rounded-lg bg-gray-100 text-gray-800 disabled:opacity-50 border"
                            disabled={!i.canDelete}
                            title={
                              i.symbol === "CASH"
                                ? "Cash cannot be removed"
                                : i.canDelete
                                ? "Remove"
                                : "Only entries created via Add Asset (not linked to the journal) can be removed"
                            }
                            onClick={() => askDelete(i.symbol)}
                          >
                            Delete
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

      {showAddAsset && (
        <AddAssetModal
          onClose={() => setShowAddAsset(false)}
          onDone={async () => {
            setShowAddAsset(false)
            await load()
          }}
          onError={(m) => showInfo("Error", m)}
        />
      )}

      {showCash && (
        <CashModal
          kind={showCash.kind}
          onClose={() => setShowCash(null)}
          onDone={async () => {
            setShowCash(null)
            await load()
          }}
          onError={(m) => showInfo("Error", m)}
        />
      )}

      {trade && (
        <TradeModal
          symbol={trade.symbol}
          type={trade.type}
          cashAvail={data?.cashUsd ?? 0}
          maxQty={data?.items.find((i) => i.symbol === trade.symbol)?.amount ?? 0}
          onClose={() => setTrade(null)}
          onDone={async () => {
            setTrade(null)
            await load()
          }}
          onError={(m) => showInfo("Error", m)}
        />
      )}

      <Modal
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        title={`Delete ${deleteSymbol ?? ""}?`}
        footer={
          <div className="flex items-center justify-end gap-3">
            <button className="rounded-xl bg-gray-100 px-4 py-2 text-sm hover:bg-gray-200" onClick={() => setConfirmOpen(false)}>
              Cancel
            </button>
            <button
              onClick={() => void confirmDelete()}
              disabled={deleting}
              className="rounded-xl bg-orange-600 text-white px-4 py-2 text-sm hover:opacity-90 disabled:opacity-50"
            >
              Delete
            </button>
          </div>
        }
      >
        <div className="text-sm text-gray-600">This removes only the initial entries created via “Add Asset”.</div>
      </Modal>

      <Modal
        open={infoOpen}
        onClose={() => setInfoOpen(false)}
        title={infoTitle}
        footer={
          <div className="text-right">
            <button className="rounded-xl bg-gray-900 text-white px-4 py-2" onClick={() => setInfoOpen(false)}>
              OK
            </button>
          </div>
        }
      >
        <div className="text-sm text-gray-700">{infoMsg}</div>
      </Modal>

      <footer className="text-xs text-gray-500 py-6 flex items-center gap-6">
        <span>© 2025 Maverick AI. All rights reserved.</span>
        <a href="#" className="hover:underline">
          Support
        </a>
        <a href="#" className="hover:underline">
          Terms
        </a>
        <a href="#" className="hover:underline">
          Privacy
        </a>
      </footer>
    </div>
  )
}

function AddAssetModal(props: { onClose: () => void; onDone: () => Promise<void>; onError: (msg: string) => void }) {
  const [symbol, setSymbol] = useState("")
  const [amount, setAmount] = useState<number>(0)
  const [price, setPrice] = useState<number>(0)
  const [fee, setFee] = useState<number>(0)
  const [busy, setBusy] = useState(false)

  return (
    <Modal
      open
      onClose={props.onClose}
      title="Add Asset"
      footer={
        <div className="flex items-center justify-end gap-3">
          <button className="rounded-xl bg-gray-100 px-4 py-2 text-sm hover:bg-gray-200" onClick={props.onClose}>
            Cancel
          </button>
          <button
            className="rounded-xl bg-gray-900 text-white px-4 py-2 text-sm disabled:opacity-50"
            disabled={!symbol || amount <= 0 || price <= 0 || busy}
            onClick={async () => {
              try {
                setBusy(true)
                const res = await fetch("/api/portfolio/add-asset", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ symbol: symbol.toUpperCase(), amount, priceUsd: price, feeUsd: fee || 0 }),
                })
                if (!res.ok) {
                  const j = await res.json().catch(() => ({}))
                  throw new Error(j?.error || "Failed to add asset")
                }
                await props.onDone()
              } catch (err) {
                props.onError(err instanceof Error ? err.message : "Failed")
              } finally {
                setBusy(false)
              }
            }}
          >
            Add
          </button>
        </div>
      }
    >
      <div className="grid gap-3">
        <Field label="Symbol">
          <input
            list="asset-suggestions"
            className="w-full rounded-xl border border-gray-200 px-3 py-2"
            value={symbol}
            onChange={(e) => setSymbol(e.target.value.toUpperCase())}
            placeholder="e.g. BTC, ETH, SOL"
          />
          <datalist id="asset-suggestions">
            <option value="BTC" />
            <option value="ETH" />
            <option value="SOL" />
            <option value="ADA" />
            <option value="XRP" />
            <option value="DOGE" />
            <option value="BNB" />
            <option value="USD" />
          </datalist>
        </Field>
        <Field label="Amount">
          <NumInput value={amount} onChange={(e) => setAmount(Number(e.target.value))} />
        </Field>
        <Field label="Price (USD)">
          <NumInput value={price} onChange={(e) => setPrice(Number(e.target.value))} />
        </Field>
        <Field label="Fee (USD) – optional">
          <NumInput value={fee} onChange={(e) => setFee(Number(e.target.value))} />
        </Field>
      </div>
    </Modal>
  )
}

function CashModal(props: { kind: "deposit" | "withdraw"; onClose: () => void; onDone: () => Promise<void>; onError: (msg: string) => void }) {
  const [amount, setAmount] = useState<number>(0)
  const [busy, setBusy] = useState(false)

  return (
    <Modal
      open
      onClose={props.onClose}
      title={props.kind === "deposit" ? "Add Cash" : "Withdraw Cash"}
      footer={
        <div className="flex items-center justify-end gap-3">
          <button className="rounded-xl bg-gray-100 px-4 py-2 text-sm hover:bg-gray-200" onClick={props.onClose}>
            Cancel
          </button>
          <button
            className="rounded-xl bg-gray-900 text-white px-4 py-2 text-sm disabled:opacity-50"
            disabled={amount <= 0 || busy}
            onClick={async () => {
              try {
                setBusy(true)
                const res = await fetch("/api/portfolio/cash", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ amountUsd: amount, kind: props.kind }),
                })
                if (!res.ok) {
                  const j = await res.json().catch(() => ({}))
                  throw new Error(j?.error || "Operation failed")
                }
                await props.onDone()
              } catch (err) {
                props.onError(err instanceof Error ? err.message : "Failed")
              } finally {
                setBusy(false)
              }
            }}
          >
            Confirm
          </button>
        </div>
      }
    >
      <div className="grid gap-3">
        <Field label="Amount (USD)">
          <NumInput value={amount} onChange={(e) => setAmount(Number(e.target.value))} />
        </Field>
      </div>
    </Modal>
  )
}

function TradeModal(props: {
  symbol: string
  type: "buy" | "sell"
  cashAvail: number
  maxQty: number
  onClose: () => void
  onDone: () => Promise<void>
  onError: (msg: string) => void
}) {
  const [price, setPrice] = useState<number>(0)
  const [fee, setFee] = useState<number>(0)
  const [value, setValue] = useState<number>(0)
  const [busy, setBusy] = useState(false)

  const isBuy = props.type === "buy"
  const limitText = isBuy ? `Cash available: ${usd(props.cashAvail)}` : `Max qty: ${props.maxQty}`

  const disabled =
    price <= 0 ||
    value <= 0 ||
    busy ||
    (isBuy ? value + fee > props.cashAvail + 1e-8 : value > props.maxQty + 1e-8)

  return (
    <Modal
      open
      onClose={props.onClose}
      title={`${isBuy ? "Buy" : "Sell"} ${props.symbol}`}
      footer={
        <div className="flex items-center justify-end gap-3">
          <button className="rounded-xl bg-gray-100 px-4 py-2 text-sm hover:bg-gray-200" onClick={props.onClose}>
            Cancel
          </button>
          <button
            className="rounded-xl bg-gray-900 text-white px-4 py-2 text-sm disabled:opacity-50"
            disabled={disabled}
            onClick={async () => {
              try {
                setBusy(true)
                const url = isBuy ? "/api/portfolio/buy" : "/api/portfolio/sell"
                const body = isBuy
                  ? { symbol: props.symbol, priceUsd: price, cashToSpend: value, feeUsd: fee || 0 }
                  : { symbol: props.symbol, priceUsd: price, amountToSell: value, feeUsd: fee || 0 }

                const res = await fetch(url, {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify(body),
                })
                if (!res.ok) {
                  const j = await res.json().catch(() => ({}))
                  throw new Error(j?.error || "Trade failed")
                }
                await props.onDone()
              } catch (err) {
                props.onError(err instanceof Error ? err.message : "Failed")
              } finally {
                setBusy(false)
              }
            }}
          >
            Confirm
          </button>
        </div>
      }
    >
      <div className="grid gap-3">
        <Field label="Price (USD)">
          <NumInput value={price} onChange={(e) => setPrice(Number(e.target.value))} />
        </Field>

        {isBuy ? (
          <Field label="Cash to Spend (USD)">
            <NumInput value={value} onChange={(e) => setValue(Number(e.target.value))} />
          </Field>
        ) : (
          <Field label="Amount to Sell">
            <NumInput value={value} onChange={(e) => setValue(Number(e.target.value))} />
          </Field>
        )}

        <Field label="Fee (USD)">
          <NumInput value={fee} onChange={(e) => setFee(Number(e.target.value))} />
        </Field>

        <div className="text-xs text-gray-500">{limitText}</div>
      </div>
    </Modal>
  )
}

function Field(props: { label: string; children: React.ReactNode }) {
  return (
    <label className="grid gap-1">
      <span className="text-xs text-gray-500">{props.label}</span>
      {props.children}
    </label>
  )
}
function NumInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input type="number" step="any" className="w-full rounded-xl border border-gray-200 px-3 py-2" {...props} />
}
