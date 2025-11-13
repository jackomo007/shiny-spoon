"use client"

import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import Card from "@/components/ui/Card"
import Modal from "@/components/ui/Modal"
import { Table, Th, Tr, Td } from "@/components/ui/Table"
import AssetAutocomplete from "@/components/trade-analyzer/AssetAutocomplete"
import { PieChart, Pie, Legend, Tooltip, ResponsiveContainer, Cell } from "recharts"
import { MoneyInputStandalone } from "@/components/form/MaskedFields"
import type React from "react"

type Item = {
  symbol: string
  amount: number
  priceUsd: number
  valueUsd: number
  percent: number
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

function nowLocalForInput(): string {
  const d = new Date()
  const pad = (n: number) => String(n).padStart(2, "0")
  const yyyy = d.getFullYear()
  const mm = pad(d.getMonth() + 1)
  const dd = pad(d.getDate())
  const hh = pad(d.getHours())
  const mi = pad(d.getMinutes())
  return `${yyyy}-${mm}-${dd}T${hh}:${mi}`
}

function DateTimeInput(props: { value: string; onChange: (v: string) => void; disabled?: boolean }) {
  return (
    <input
      type="datetime-local"
      className="w-full rounded-xl border border-gray-200 px-3 py-2"
      value={props.value}
      onChange={(e) => props.onChange(e.target.value)}
      disabled={props.disabled}
    />
  )
}

export default function PortfolioPage() {
  const [data, setData] = useState<PortfolioRes | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [showAddAsset, setShowAddAsset] = useState(false)
  const [showCash, setShowCash] = useState<null | { kind: "deposit" | "withdraw" }>(null)
  const [editAsset, setEditAsset] = useState<Item | null>(null)

  const [infoOpen, setInfoOpen] = useState(false)
  const [infoTitle, setInfoTitle] = useState<string>("")
  const [infoMsg, setInfoMsg] = useState<string>("")

  const [confirmOpen, setConfirmOpen] = useState(false)
  const [deleteSymbol, setDeleteSymbol] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)

  const [tab, setTab] = useState<"portfolio" | "history">("portfolio")

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

      const isCash = deleteSymbol === "CASH"

      if (isCash) {
        // For CASH, we want to zero it out everywhere, not just "delete a row".
        const currentCash = data?.cashUsd ?? 0

        if (currentCash > 0) {
          const res = await fetch("/api/portfolio/cash", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ amountUsd: currentCash, kind: "withdraw" }),
          })

          if (!res.ok) {
            const j = await res.json().catch(() => ({}))
            throw new Error(j?.error || "Failed to clear cash")
          }
        }

        setConfirmOpen(false)
        setDeleteSymbol(null)
        await load()
        showInfo("Cash cleared", "Cash was set to 0 and removed from your portfolio.")
        return
      }

      // Normal asset delete flow
      const res = await fetch(
        `/api/portfolio/${encodeURIComponent(deleteSymbol)}?cascade=true`,
        { method: "DELETE" },
      )
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        throw new Error(j?.error || "Delete failed")
      }

      setConfirmOpen(false)
      const deletedSym = deleteSymbol
      setDeleteSymbol(null)
      await load()
      showInfo("Deleted", `${deletedSym} and related journal entries were removed.`)
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
          <h1 className="text-2xl font-semibold">Portfolio Manager</h1>
          <p className="text-sm text-gray-500">Build and manage your spot portfolio</p>

          <div className="mt-3 flex gap-2">
            <button
              className={`px-3 py-1.5 rounded-xl border ${
                tab === "portfolio" ? "bg-black text-white" : "bg-white"
              }`}
              onClick={() => setTab("portfolio")}
            >
              Portfolio
            </button>
            <button
              className={`px-3 py-1.5 rounded-xl border ${
                tab === "history" ? "bg-black text-white" : "bg-white"
              }`}
              onClick={() => setTab("history")}
            >
              Trade History
            </button>
          </div>
        </div>

        {tab === "portfolio" && (
          <div className="flex gap-2">
            <button
              className="px-3 py-2 rounded-xl bg-gray-900 text-white"
              onClick={() => setShowAddAsset(true)}
            >
              + Add Asset
            </button>
            <button
              className="px-3 py-2 rounded-xl bg-emerald-600 text-white"
              onClick={() => setShowCash({ kind: "deposit" })}
            >
              + Add Cash
            </button>
            <button
              className="px-3 py-2 rounded-xl bg-rose-600 text-white"
              onClick={() => setShowCash({ kind: "withdraw" })}
            >
              Withdraw
            </button>
          </div>
        )}
      </div>

      {tab === "portfolio" ? (
        <Card className="p-0">
          {loading ? (
            <div className="h-[360px] w-full rounded-xl bg-gray-100 animate-pulse m-6" />
          ) : error ? (
            <div className="p-6 text-red-600">{error}</div>
          ) : (
            <div className="p-6">
              <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
                <div className="text-lg font-semibold">
                  Total Portfolio Value: {usd(data!.totalValueUsd)}
                </div>
                <div className="text-sm text-gray-600">
                  Cash: <span className="font-medium">{usd(data!.cashUsd)}</span>
                </div>
              </div>

              <div className="h-[400px] rounded-xl border bg-white mb-6">
                <div className="px-4 pt-3 font-medium">Allocation</div>
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
                      <Th>Entry Price</Th>
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
                          <button
                            className="px-3 py-1 rounded-lg bg-gray-900 text-white disabled:opacity-50"
                            onClick={() => setEditAsset(i)}
                          >
                            Edit
                          </button>
                        </Td>
                      </Tr>
                    ))}
                  </tbody>
                </Table>
              </div>
            </div>
          )}
        </Card>
      ) : (
        <TradeHistoryCard />
      )}

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
          cashAvail={data?.cashUsd ?? 0}
          onClose={() => setShowCash(null)}
          onDone={async () => {
            setShowCash(null)
            await load()
          }}
          onError={(m) => showInfo("Error", m)}
        />
      )}

      {editAsset && (
        <EditAssetModal
          asset={editAsset}
          onClose={() => setEditAsset(null)}
          onDone={async () => {
            setEditAsset(null)
            await load()
          }}
          onError={(m) => showInfo("Error", m)}
          onDelete={(symbol) => {
            setEditAsset(null)
            askDelete(symbol)
          }}
        />
      )}

      <Modal
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        title={`Delete ${deleteSymbol ?? ""}?`}
        footer={
          <div className="flex items-center justify-end gap-3">
            <button
              className="rounded-xl bg-gray-100 px-4 py-2 text-sm hover:bg-gray-200"
              onClick={() => setConfirmOpen(false)}
            >
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
        <div className="text-sm text-gray-700">
          This will permanently remove <b>{deleteSymbol}</b> from your Portfolio
          <br />
          <b>and all related entries in the Trading Journal</b> (child and parent records).
        </div>
      </Modal>

      <Modal
        open={infoOpen}
        onClose={() => setInfoOpen(false)}
        title={infoTitle}
        footer={
          <div className="text-right">
            <button
              className="rounded-xl bg-gray-900 text-white px-4 py-2"
              onClick={() => setInfoOpen(false)}
            >
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

function TradeHistoryCard() {
  type Row = {
    id: string
    when: string
    asset: string
    kind: "buy" | "sell" | "cash_in" | "cash_out" | "init"
    qty: number
    priceUsd: number
    feeUsd: number
    cashDeltaUsd: number
    note?: string | null
  }

  const [rows, setRows] = useState<Row[]>([])
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState<string | null>(null)

  useEffect(() => {
    ;(async () => {
      setLoading(true)
      setErr(null)
      try {
        const r = await fetch("/api/portfolio/history?limit=500", { cache: "no-store" })
        if (!r.ok) throw new Error(`HTTP ${r.status}`)
        const j = (await r.json()) as { items: Row[] }
        setRows(j.items)
      } catch (e) {
        setErr(e instanceof Error ? e.message : "Failed to load")
      } finally {
        setLoading(false)
      }
    })()
  }, [])

  return (
    <Card className="p-0">
      {loading ? (
        <div className="h-[240px] w-full rounded-xl bg-gray-100 animate-pulse m-6" />
      ) : err ? (
        <div className="p-6 text-red-600">{err}</div>
      ) : (
        <div className="p-6">
          <div className="text-lg font-semibold mb-4">Trade History</div>
          <div className="rounded-xl bg-white">
            <Table>
              <thead>
                <tr>
                  <Th>Date</Th>
                  <Th>Asset</Th>
                  <Th>Type</Th>
                  <Th>Qty</Th>
                  <Th>Entry Price</Th>
                  <Th>Fee</Th>
                  <Th>Cash</Th>
                  <Th>Note</Th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <Tr key={r.id}>
                    <Td>{new Date(r.when).toLocaleString()}</Td>
                    <Td>{r.asset}</Td>
                    <Td className="capitalize">{r.kind.replace("_", " ")}</Td>
                    <Td>{r.qty.toFixed(8).replace(/\.?0+$/, "")}</Td>
                    <Td>{usd(r.priceUsd)}</Td>
                    <Td>{usd(r.feeUsd)}</Td>
                    <Td className={r.cashDeltaUsd >= 0 ? "text-emerald-600" : "text-rose-600"}>
                      {usd(r.cashDeltaUsd)}
                    </Td>
                    <Td>{r.note ?? ""}</Td>
                  </Tr>
                ))}
              </tbody>
            </Table>
          </div>
        </div>
      )}
    </Card>
  )
}

function EditAssetModal(props: {
  asset: Item
  onClose: () => void
  onDone: () => Promise<void>
  onError: (msg: string) => void
  onDelete: (symbol: string) => void
}) {
  const router = useRouter()

  const [amountStr, setAmountStr] = useState<string>(
    props.asset.amount ? props.asset.amount.toString() : ""
  )
  const [priceStr, setPriceStr] = useState<string>(
    props.asset.priceUsd ? props.asset.priceUsd.toString() : ""
  )
  const [when, setWhen] = useState<string>(nowLocalForInput())
  const [addToJournal, setAddToJournal] = useState(false)
  const [busy, setBusy] = useState(false)

  const amount = amountStr === "" ? 0 : Number(amountStr)
  const price = priceStr === "" ? 0 : Number(priceStr)
  const canSave = amount > 0 && price > 0 && !busy

  return (
    <Modal
      open
      onClose={props.onClose}
      title={`Edit ${props.asset.symbol}`}
      footer={
        <div className="flex items-center justify-end gap-3">
          <button
            className="rounded-xl bg-gray-100 px-4 py-2 text-sm hover:bg-gray-200"
            onClick={props.onClose}
          >
            Cancel
          </button>

          <button
            className="rounded-xl bg-rose-600 text-white px-4 py-2 text-sm hover:opacity-90"
            onClick={() => props.onDelete(props.asset.symbol)}
          >
            Delete
          </button>

          <button
            className="rounded-xl bg-gray-900 text-white px-4 py-2 text-sm disabled:opacity-50"
            disabled={!canSave}
            onClick={async () => {
              try {
                setBusy(true)
                const executedAtIso = new Date(when).toISOString()

                // ⚠️ CASO ESPECIAL: CASH
                if (props.asset.symbol === "CASH") {
                  const originalCash = props.asset.amount // assume amount = total cash atual
                  const newCash = amount                   // valor TOTAL desejado
                  const delta = newCash - originalCash

                  if (Math.abs(delta) > 0) {
                    const kind = delta > 0 ? "deposit" : "withdraw"
                    const res = await fetch("/api/portfolio/cash", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({
                        amountUsd: Math.abs(delta),
                        kind,
                        executedAt: executedAtIso,
                      }),
                    })

                    if (!res.ok) {
                      const j = await res.json().catch(() => ({} as { error?: string }))
                      throw new Error(j?.error || "Failed to update cash")
                    }
                  }

                  await props.onDone()
                  return
                }

                // ✅ FLUXO NORMAL: outros assets
                const originalAmount = props.asset.amount
                const amountDelta = amount - originalAmount

                const res = await fetch("/api/portfolio/add-asset", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    symbol: props.asset.symbol.toUpperCase(),
                    amount,
                    amountDelta,
                    priceUsd: price,
                    executedAt: executedAtIso,
                    mode: "edit",
                  }),
                })

                if (!res.ok) {
                  const j = await res.json().catch(() => ({} as { error?: string }))
                  throw new Error(j?.error || "Failed to update asset")
                }

                if (addToJournal) {
                  const amountSpent = amount * price
                  const qs = new URLSearchParams({
                    from: "portfolio",
                    asset_name: props.asset.symbol,
                    trade_type: "1",
                    trade_datetime: when,
                    amount_spent: String(amountSpent),
                    entry_price: String(price),
                  })
                  router.push(`/journal?${qs.toString()}`)
                } else {
                  await props.onDone()
                }
              } catch (err) {
                props.onError(err instanceof Error ? err.message : "Failed to update asset")
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
        <Field label="Asset">
          <input
            type="text"
            className="w-full rounded-xl border border-gray-200 px-3 py-2 bg-gray-50"
            value={props.asset.symbol}
            readOnly
          />
        </Field>

        <Field label="Asset Amount">
          <MoneyInputStandalone
            valueRaw={amountStr}
            onChangeRaw={setAmountStr}
            maxDecimals={8}
            placeholder="0"
            className="w-full rounded-xl border border-gray-200 px-3 py-2"
          />
        </Field>

        <Field label="Entry Price (USD)">
          <MoneyInputStandalone
            valueRaw={priceStr}
            onChangeRaw={setPriceStr}
            maxDecimals={8}
            placeholder="0"
            className="w-full rounded-xl border border-gray-200 px-3 py-2"
          />
        </Field>

        <Field label="Date Purchased">
          <DateTimeInput value={when} onChange={setWhen} />
        </Field>

        <div className="mt-2 flex items-center gap-2">
          <input
            id="add-to-journal"
            type="checkbox"
            className="h-4 w-4 rounded border-gray-300"
            checked={addToJournal}
            onChange={(e) => setAddToJournal(e.target.checked)}
          />
          <label htmlFor="add-to-journal" className="text-sm text-gray-700">
            Add To Trading Journal
          </label>
        </div>
      </div>
    </Modal>
  )
}


function AddAssetModal(props: {
  onClose: () => void
  onDone: () => Promise<void>
  onError: (msg: string) => void
}) {
  type StrategyOpt = { id: string; name: string | null }

  const [strategies, setStrategies] = useState<StrategyOpt[]>([])
  const [strategyId, setStrategyId] = useState<string>("")
  const [when, setWhen] = useState<string>(nowLocalForInput())

  useEffect(() => {
    ;(async () => {
      try {
        const r = await fetch("/api/strategies", { cache: "no-store" })
        if (!r.ok) return
        const j = (await r.json()) as { items: Array<{ id: string; name: string | null }> }
        const base = j.items.map((s) => ({ id: s.id, name: s.name }))
        const hasNone = base.some((s) => (s.name ?? "").toLowerCase() === "none")
        const list = hasNone ? base : [{ id: "NONE", name: "None" }, ...base]
        setStrategies(list)
      } catch {}
    })()
  }, [])

  const [symbol, setSymbol] = useState("")
  const [amountStr, setAmountStr] = useState<string>("")
  const [priceStr, setPriceStr] = useState<string>("")
  const [feeStr, setFeeStr] = useState<string>("")
  const [busy, setBusy] = useState(false)

  const toNum = (v: string): number => ((v ?? "") === "" ? NaN : Number(v))

  const amount = toNum(amountStr)
  const price = toNum(priceStr)
  const feeRaw = toNum(feeStr)
  const fee = Number.isNaN(feeRaw) ? 0 : feeRaw

  const canConfirm =
    !!symbol && Number.isFinite(amount) && amount > 0 && Number.isFinite(price) && price > 0 && !busy

  function normTicker(input: string): string {
    const v = (input || "").trim().toUpperCase()
    if (!v) return ""
    return v.includes(":") ? v.split(":")[1]?.replace(/\s+/g, "") ?? "" : v.replace(/\s+/g, "")
  }

  return (
    <Modal
      open
      onClose={props.onClose}
      title="Add Asset"
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
            disabled={!canConfirm}
            onClick={async () => {
              try {
                setBusy(true)
                const payload = {
                  symbol: symbol.toUpperCase(),
                  amount,
                  priceUsd: price,
                  feeUsd: fee || 0,
                  strategyId: strategyId && strategyId !== "NONE" ? strategyId : undefined,
                  executedAt: new Date(when).toISOString(),
                }
                const res = await fetch("/api/portfolio/add-asset", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify(payload),
                })
                if (!res.ok) {
                  const j = await res.json().catch(() => ({} as { error?: string }))
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
        {strategies.length > 0 && strategyId === "NONE" && (
          <div className="text-sm text-red-600 rounded-lg border border-red-200 bg-red-50 px-3 py-2">
            Note: To get the most out of our AI trading tools and reduce risk, it’s important to
            have a clear strategy in place. Trading without one can increase the chance of losses
            and limit how effectively our AI can assist you.
          </div>
        )}
        <Field label="Asset">
          <AssetAutocomplete value={symbol} onChange={(val: string) => setSymbol(normTicker(val))} />
        </Field>

        <Field label="Asset Amount">
          <MoneyInputStandalone
            valueRaw={amountStr}
            onChangeRaw={setAmountStr}
            placeholder="0"
            className="w-full rounded-xl border border-gray-200 px-3 py-2"
          />
        </Field>

        <Field label="Entry Price (USD)">
          <MoneyInputStandalone
            valueRaw={priceStr}
            onChangeRaw={setPriceStr}
            maxDecimals={8}
            placeholder="0"
            className="w-full rounded-xl border border-gray-200 px-3 py-2"
          />
        </Field>

        <Field label="Date Purchased">
          <DateTimeInput value={when} onChange={setWhen} />
        </Field>
      </div>
    </Modal>
  )
}

function CashModal(props: {
  kind: "deposit" | "withdraw"
  cashAvail: number
  onClose: () => void
  onDone: () => Promise<void>
  onError: (msg: string) => void
}) {
  const [amountRaw, setAmountRaw] = useState<string>("")
  const amountNum = amountRaw === "" ? 0 : Number(amountRaw)
  const [busy, setBusy] = useState(false)
  const isWithdraw = props.kind === "withdraw"
  const [when] = useState<string>(nowLocalForInput())

  return (
    <Modal
      open
      onClose={props.onClose}
      title={props.kind === "deposit" ? "Add Cash" : "Withdraw Cash"}
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
            disabled={
              amountNum <= 0 || busy || (isWithdraw && amountNum > (props.cashAvail ?? 0) + 1e-8)
            }
            onClick={async () => {
              try {
                setBusy(true)
                const res = await fetch("/api/portfolio/cash", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ amountUsd: amountNum, kind: props.kind }),
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
          <div className="flex gap-2">
            <MoneyInputStandalone
              valueRaw={amountRaw}
              onChangeRaw={setAmountRaw}
              placeholder="0"
              className="w-full rounded-xl border border-gray-200 px-3 py-2"
            />
            {isWithdraw && (
              <button
                type="button"
                className="px-3 py-2 rounded-xl border"
                onClick={() => setAmountRaw((props.cashAvail ?? 0).toFixed(2))}
                title="Withdraw all available cash"
              >
                Max
              </button>
            )}
          </div>
        </Field>

        <Field label="Date Purchased">
          <DateTimeInput value={when} onChange={() => {}} disabled />
        </Field>
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
  return (
    <input
      type="number"
      inputMode="decimal"
      step="any"
      className="w-full rounded-xl border border-gray-200 px-3 py-2"
      {...props}
    />
  )
}
