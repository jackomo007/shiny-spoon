"use client"

import { useState } from "react"
import Image from "next/image"
import Card from "@/components/ui/Card"

type StrategyOpt = { id: string; name: string | null }
type TradeType = "spot" | "futures"
type Side = "buy" | "sell" | "long" | "short"
type TF = "h1" | "h4" | "d1"

export default function TradeAnalyzerClient({ strategies }: { strategies: StrategyOpt[] }) {
  const [strategyId, setStrategyId] = useState<string>("")
  const [asset, setAsset] = useState("BTCUSDT")
  const [tradeType, setTradeType] = useState<TradeType>("spot")
  const [side, setSide] = useState<Side>("buy")
  const [amountSpent, setAmountSpent] = useState<number>(100)
  const [entry, setEntry] = useState<number>(0)
  const [target, setTarget] = useState<number | "">("")
  const [stop, setStop] = useState<number | "">("")
  const [tf, setTf] = useState<TF>("h1")

  const [loading, setLoading] = useState(false)
  const [analysis, setAnalysis] = useState<string>("")
  const [imageUrl, setImageUrl] = useState<string>("")

  function ensureSide(t: TradeType) {
    if (t === "spot" && (side === "long" || side === "short")) setSide("buy")
    if (t === "futures" && (side === "buy" || side === "sell")) setSide("long")
  }

  async function submit() {
    setLoading(true)
    setAnalysis("")
    setImageUrl("")
    try {
        const payload = {
        strategy_id: strategyId || undefined,
        asset: asset.trim().toUpperCase(),
        trade_type: tradeType,
        side,
        amount_spent: Number(amountSpent),
        entry_price: Number(entry),
        target_price: target === "" ? null : Number(target),
        stop_price: stop === "" ? null : Number(stop),
        timeframe: tf,
        }

        const r = await fetch("/api/trade-analyzer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        })

        const ct = r.headers.get("content-type") || ""
        const raw = await r.text()
        const js = ct.includes("application/json") && raw ? JSON.parse(raw) : null

        if (!r.ok) {
        const msg = js?.error
            ? typeof js.error === "string" ? js.error : JSON.stringify(js.error)
            : `HTTP ${r.status} ${raw || "(no body)"}`
        throw new Error(msg)
        }

        if (!js) throw new Error("Empty response from server")
        setAnalysis(js.analysis as string)
        setImageUrl(js.imageUrl as string)
    } catch (e) {
        alert(e instanceof Error ? e.message : "Failed")
    } finally {
        setLoading(false)
    }
    }

  return (
    <div className="grid gap-6">
      <div className="text-2xl font-semibold">Trade Analyzer</div>

      <Card>
        <div className="grid md:grid-cols-3 gap-4">
          <div>
            <label className="text-sm text-gray-600">Strategy Used</label>
            <select
              className="w-full rounded-xl border p-2"
              value={strategyId}
              onChange={(e) => setStrategyId(e.target.value)}
            >
              <option value="">— None —</option>
              {strategies.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name ?? s.id}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-sm text-gray-600">Asset</label>
            <input
              className="w-full rounded-xl border p-2"
              value={asset}
              onChange={(e) => setAsset(e.target.value)}
              placeholder="BTCUSDT"
            />
          </div>

          <div>
            <label className="text-sm text-gray-600">Timeframe</label>
            <select
              className="w-full rounded-xl border p-2"
              value={tf}
              onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setTf(e.target.value as TF)}
            >
              <option value="h1">1h</option>
              <option value="h4">4h</option>
              <option value="d1">1d</option>
            </select>
          </div>

          <div>
            <label className="text-sm text-gray-600">Trade Type</label>
            <select
              className="w-full rounded-xl border p-2"
              value={tradeType}
              onChange={(e: React.ChangeEvent<HTMLSelectElement>) => {
                const t = e.target.value as TradeType
                setTradeType(t)
                ensureSide(t)
              }}
            >
              <option value="spot">Spot</option>
              <option value="futures">Futures</option>
            </select>
          </div>

          <div>
            <label className="text-sm text-gray-600">Trade Side</label>
            <select
              className="w-full rounded-xl border p-2"
              value={side}
              onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setSide(e.target.value as Side)}
            >
              {tradeType === "spot" ? (
                <>
                  <option value="buy">Buy</option>
                  <option value="sell">Sell</option>
                </>
              ) : (
                <>
                  <option value="long">Long</option>
                  <option value="short">Short</option>
                </>
              )}
            </select>
          </div>

          <div>
            <label className="text-sm text-gray-600">Amount Spent</label>
            <input
              type="number"
              className="w-full rounded-xl border p-2"
              value={amountSpent}
              onChange={(e) => setAmountSpent(Number(e.target.value))}
            />
          </div>

          <div>
            <label className="text-sm text-gray-600">Entry Price</label>
            <input
              type="number"
              className="w-full rounded-xl border p-2"
              value={entry}
              onChange={(e) => setEntry(Number(e.target.value))}
            />
          </div>

          <div>
            <label className="text-sm text-gray-600">Target Exit Price</label>
            <input
              type="number"
              className="w-full rounded-xl border p-2"
              value={target}
              onChange={(e) => setTarget(e.target.value === "" ? "" : Number(e.target.value))}
            />
          </div>

          <div>
            <label className="text-sm text-gray-600">Stop Loss Price</label>
            <input
              type="number"
              className="w-full rounded-xl border p-2"
              value={stop}
              onChange={(e) => setStop(e.target.value === "" ? "" : Number(e.target.value))}
            />
          </div>
        </div>

        <div className="mt-4 flex justify-end gap-3">
          <button
            disabled={loading}
            onClick={submit}
            className="rounded-xl bg-black text-white px-4 py-2 disabled:opacity-50"
          >
            {loading ? "Analyzing…" : "Analyze"}
          </button>
        </div>
      </Card>

      {(imageUrl || analysis) && (
        <Card>
          <div className="text-lg font-semibold mb-3">Result</div>
          {imageUrl && (
            <div className="rounded-xl border mb-4 overflow-hidden">
              <Image
                src={imageUrl}
                alt="Trade analysis chart"
                width={1280}
                height={720}
                className="w-full h-auto"
              />
            </div>
          )}
          <pre className="whitespace-pre-wrap text-sm leading-relaxed">{analysis}</pre>
        </Card>
      )}
    </div>
  )
}
