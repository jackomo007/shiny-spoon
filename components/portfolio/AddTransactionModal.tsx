"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import Modal from "@/components/ui/Modal"
import { MoneyInputStandalone } from "@/components/form/MaskedFields"
import { cls, usd } from "@/components/portfolio/format"

type AssetPick = {
  id: string
  symbol: string
  name: string
  thumb?: string | null
  priceUsd?: number | null
  change24hPct?: number | null
}

type Step = "pick" | "form"

type TopAssetsResponse = {
  items: Array<{
    id: string
    symbol: string
    name: string
    image: string | null
    priceUsd: number | null
    change24hPct: number | null
    marketCapRank: number | null
  }>
}

type SearchAssetsResponse = {
  items: Array<{
    id: string
    symbol: string
    name: string
    thumb: string | null
  }>
}

type PriceResponse = { priceUsd: number; change24hPct: number | null }

export default function AddTransactionModal(props: {
  open: boolean
  onClose: () => void
  onDone: () => Promise<void>
}) {
  const [step, setStep] = useState<Step>("pick")
  const [top, setTop] = useState<AssetPick[]>([])
  const [query, setQuery] = useState("")
  const [results, setResults] = useState<AssetPick[]>([])
  const [selected, setSelected] = useState<AssetPick | null>(null)

  const [side, setSide] = useState<"buy" | "sell">("buy")
  const [priceMode, setPriceMode] = useState<"market" | "custom">("market")
  const [priceUsd, setPriceUsd] = useState<number>(0)

  const [amountRaw, setAmountRaw] = useState<string>("")
  const [totalRaw, setTotalRaw] = useState<string>("")
  const [busy, setBusy] = useState(false)

  const lastEdited = useRef<"amount" | "total" | null>(null)

  function resetAll() {
    setStep("pick")
    setQuery("")
    setResults([])
    setSelected(null)

    setSide("buy")
    setPriceMode("market")
    setPriceUsd(0)

    setAmountRaw("")
    setTotalRaw("")
    setBusy(false)

    lastEdited.current = null
  }

  useEffect(() => {
    if (!props.open) resetAll()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.open])

  useEffect(() => {
    if (!props.open) return

    ;(async () => {
      const res = await fetch("/api/portfolio/assets/top", { cache: "no-store" })
      if (!res.ok) return

      const j = (await res.json()) as TopAssetsResponse
      setTop(
        (j.items ?? []).map((x) => ({
          id: x.id,
          symbol: x.symbol,
          name: x.name,
          thumb: x.image ?? null,
          priceUsd: x.priceUsd ?? null,
          change24hPct: x.change24hPct ?? null,
        }))
      )
    })()
  }, [props.open])

  useEffect(() => {
    if (!props.open) return

    const q = query.trim()
    if (!q) {
      setResults([])
      return
    }

    const t = setTimeout(async () => {
      const res = await fetch(`/api/portfolio/assets/search?q=${encodeURIComponent(q)}`, { cache: "no-store" })
      if (!res.ok) return

      const j = (await res.json()) as SearchAssetsResponse
      setResults(
        (j.items ?? []).map((x) => ({
          id: x.id,
          symbol: x.symbol,
          name: x.name,
          thumb: x.thumb ?? null,
        }))
      )
    }, 250)

    return () => clearTimeout(t)
  }, [query, props.open])

  const priceLabel = useMemo(
    () => (priceMode === "market" ? "Market Price (USD)" : "Custom Price (USD)"),
    [priceMode]
  )

  async function loadMarketPrice(id: string) {
    const res = await fetch(`/api/portfolio/assets/price?id=${encodeURIComponent(id)}`, { cache: "no-store" })
    if (!res.ok) return
    const j = (await res.json()) as PriceResponse
    setPriceUsd(Number(j.priceUsd ?? 0))
  }

  function numFromRaw(s: string) {
    if (!s) return 0
    const n = Number(s)
    return Number.isFinite(n) ? n : 0
  }

  useEffect(() => {
    if (!selected) return
    if (!priceUsd || priceUsd <= 0) return

    const amount = numFromRaw(amountRaw)
    const total = numFromRaw(totalRaw)

    if (lastEdited.current === "amount") {
      const newTotal = amount * priceUsd
      setTotalRaw(amount ? String(newTotal) : "")
    } else if (lastEdited.current === "total") {
      const newAmount = total / priceUsd
      setAmountRaw(total ? String(newAmount) : "")
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [priceUsd])

  const canSave = !!selected && priceUsd > 0 && (!!amountRaw || !!totalRaw) && !busy

  return (
    <Modal
      open={props.open}
      onClose={() => {
        props.onClose()
      }}
      title={step === "pick" ? "Add Asset" : `Add Asset • ${selected?.symbol ?? ""}`}
      footer={
        <div className="flex items-center justify-end gap-3">
          <button
            className="rounded-xl bg-gray-100 px-4 py-2 text-sm hover:bg-gray-200"
            onClick={() => {
              props.onClose()
            }}
            disabled={busy}
          >
            Cancel
          </button>

          {step === "pick" ? null : (
            <button
              className="rounded-xl bg-gray-900 text-white px-4 py-2 text-sm disabled:opacity-50"
              disabled={!canSave}
              onClick={async () => {
                if (!selected) return
                try {
                  setBusy(true)
                  const amount = numFromRaw(amountRaw)
                  const total = numFromRaw(totalRaw)

                  const payload: {
                    asset: { id: string; symbol: string; name: string }
                    side: "buy" | "sell"
                    priceMode: "market" | "custom"
                    priceUsd?: number
                    qty?: number
                    totalUsd?: number
                    feeUsd: number
                    executedAt: string
                  } = {
                    asset: { id: selected.id, symbol: selected.symbol, name: selected.name },
                    side,
                    priceMode,
                    priceUsd: priceMode === "custom" ? priceUsd : undefined,
                    qty: lastEdited.current === "total" ? undefined : amount || undefined,
                    totalUsd: lastEdited.current === "amount" ? undefined : total || undefined,
                    feeUsd: 0,
                    executedAt: new Date().toISOString(),
                  }

                  const res = await fetch("/api/portfolio/add-transaction", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(payload),
                  })

                  if (!res.ok) {
                    const j = (await res.json().catch(() => null)) as { error?: unknown } | null
                    const msg = typeof j?.error === "string" ? j.error : "Failed to add transaction"
                    throw new Error(msg)
                  }

                  await props.onDone()
                } catch (e) {
                  const msg = e instanceof Error ? e.message : "Failed"
                  alert(msg)
                } finally {
                  setBusy(false)
                }
              }}
            >
              Save
            </button>
          )}
        </div>
      }
    >
      {step === "pick" ? (
        <div className="grid gap-4">
          <label className="grid gap-1">
            <span className="text-xs text-gray-500">Search asset</span>
            <input
              className="w-full rounded-xl border border-gray-200 px-3 py-2"
              placeholder="Search BTC, ETH, Solana..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </label>

          <div className="grid gap-2">
            <div className="text-xs font-semibold text-gray-600">Top by market cap</div>
            <div className="grid gap-2 sm:grid-cols-2">
              {top.map((a) => (
                <button
                  key={a.id}
                  className="rounded-xl border border-gray-200 p-3 text-left hover:bg-gray-50"
                  onClick={async () => {
                    setSelected(a)
                    setStep("form")
                    setSide("buy")
                    setPriceMode("market")
                    setAmountRaw("")
                    setTotalRaw("")
                    lastEdited.current = null
                    await loadMarketPrice(a.id)
                  }}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="grid">
                      <span className="font-semibold">{a.symbol}</span>
                      <span className="text-xs text-gray-500">{a.name}</span>
                    </div>
                    <div className="text-sm text-gray-700">{a.priceUsd != null ? usd(a.priceUsd) : ""}</div>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {results.length > 0 && (
            <div className="grid gap-2">
              <div className="text-xs font-semibold text-gray-600">Search results</div>
              <div className="grid gap-2">
                {results.map((a) => (
                  <button
                    key={a.id}
                    className="rounded-xl border border-gray-200 p-3 text-left hover:bg-gray-50"
                    onClick={async () => {
                      setSelected(a)
                      setStep("form")
                      setSide("buy")
                      setPriceMode("market")
                      setAmountRaw("")
                      setTotalRaw("")
                      lastEdited.current = null
                      await loadMarketPrice(a.id)
                    }}
                  >
                    <div className="grid">
                      <span className="font-semibold">{a.symbol}</span>
                      <span className="text-xs text-gray-500">{a.name}</span>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="grid gap-4">
          <div className="flex flex-wrap items-center gap-2">
            <button
              className={cls(
                "px-3 py-2 rounded-xl text-sm border",
                side === "buy" ? "bg-emerald-600 text-white border-emerald-600" : "bg-white border-gray-200"
              )}
              onClick={() => setSide("buy")}
            >
              Buy
            </button>
            <button
              className={cls(
                "px-3 py-2 rounded-xl text-sm border",
                side === "sell" ? "bg-red-600 text-white border-red-600" : "bg-white border-gray-200"
              )}
              onClick={() => setSide("sell")}
            >
              Sell
            </button>
          </div>

          <div className="grid gap-2 sm:grid-cols-2">
            <label className="grid gap-1">
              <span className="text-xs text-gray-500">Price Mode</span>
              <select
                className="w-full rounded-xl border border-gray-200 px-3 py-2"
                value={priceMode}
                onChange={async (e) => {
                  const next = e.target.value as "market" | "custom"
                  setPriceMode(next)
                  if (next === "market" && selected) {
                    await loadMarketPrice(selected.id)
                  }
                }}
              >
                <option value="market">Market Price</option>
                <option value="custom">Custom Price</option>
              </select>
            </label>

            <label className="grid gap-1">
              <span className="text-xs text-gray-500">{priceLabel}</span>
              <input
                className="w-full rounded-xl border border-gray-200 px-3 py-2"
                value={priceUsd ? String(priceUsd) : ""}
                readOnly={priceMode === "market"}
                onChange={(e) => setPriceUsd(Number(e.target.value))}
                placeholder="0"
              />
            </label>
          </div>

          <div className="grid gap-2 sm:grid-cols-2">
            <label className="grid gap-1">
              <span className="text-xs text-gray-500">Amount</span>
              <MoneyInputStandalone
                valueRaw={amountRaw}
                onChangeRaw={(v) => {
                  lastEdited.current = "amount"
                  setAmountRaw(v)
                  const n = numFromRaw(v)
                  if (!n || priceUsd <= 0) setTotalRaw("")
                  else setTotalRaw(String(n * priceUsd))
                }}
                placeholder="0"
                className="w-full rounded-xl border border-gray-200 px-3 py-2"
              />
            </label>

            <label className="grid gap-1">
              <span className="text-xs text-gray-500">Total (USD)</span>
              <MoneyInputStandalone
                valueRaw={totalRaw}
                onChangeRaw={(v) => {
                  lastEdited.current = "total"
                  setTotalRaw(v)
                  const n = numFromRaw(v)
                  if (!n || priceUsd <= 0) setAmountRaw("")
                  else setAmountRaw(String(n / priceUsd))
                }}
                placeholder="0"
                className="w-full rounded-xl border border-gray-200 px-3 py-2"
              />
            </label>
          </div>

          <div className="text-xs text-gray-500">
            Amount e Total se recalculam entre si. Em Market Price, o preço é buscado automaticamente e fica readonly.
          </div>

          <button
            className="text-xs text-slate-500 underline justify-self-start"
            onClick={async () => {
              setStep("pick")
              setSelected(null)
              setAmountRaw("")
              setTotalRaw("")
              setPriceUsd(0)
              lastEdited.current = null
            }}
            type="button"
          >
            Back to asset selection
          </button>
        </div>
      )}
    </Modal>
  )
}
