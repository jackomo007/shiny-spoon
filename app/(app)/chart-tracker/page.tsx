"use client"

import { useEffect, useState } from "react"
import Image from "next/image"

type Sub = {
  tracker: {
    id: string
    tv_symbol: string
    display_symbol: string
    tf: "h1" | "h4" | "d1"
  }
}

type Analysis = {
  id: string
  image_url: string
  analysis_text: string
  created_at: string
}

export default function ChartTrackerPage() {
  const [subs, setSubs] = useState<Sub[]>([])
  const [openFor, setOpenFor] = useState<Sub["tracker"] | null>(null)
  const [analyses, setAnalyses] = useState<Analysis[]>([])
  const [loadingAnalyses, setLoadingAnalyses] = useState(false)
  const [showAdd, setShowAdd] = useState(false)

  async function refreshSubs() {
    const r = await fetch("/api/tracker/coins", { cache: "no-store" })
    if (r.ok) setSubs(await r.json())
  }

  useEffect(() => {
    refreshSubs()
  }, [])

  useEffect(() => {
    if (!openFor?.id) return

    const ctrl = new AbortController()

    ;(async () => {
      try {
        setLoadingAnalyses(true)
        console.log("[ChartTracker] fetching analyses for", openFor.id)

        const r = await fetch(
          `/api/tracker/analyses?trackerId=${encodeURIComponent(openFor.id)}`,
          { signal: ctrl.signal, cache: "no-store" }
        )

        if (!r.ok) throw new Error(`HTTP ${r.status}`)

        const data: Analysis[] = await r.json()
        setAnalyses(data)
      } catch (err) {
        console.error("[ChartTracker] fetch analyses failed:", err)
        setAnalyses([])
      } finally {
        setLoadingAnalyses(false)
      }
    })()

    return () => ctrl.abort()
  }, [openFor?.id])

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Chart Tracker</h1>
        <button
          type="button"
          className="rounded-lg px-3 py-2 border shadow"
          onClick={() => setShowAdd(true)}
        >
          + Add Coin
        </button>
      </div>

      {/* grade de cards de coins do usuário */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {subs.map((s) => (
          <div
            key={s.tracker.id}
            className="rounded-2xl p-4 border shadow hover:shadow-md transition"
          >
            <div className="flex items-center justify-between">
              <div>
                <div className="font-semibold">{s.tracker.display_symbol}</div>
                <div className="text-xs text-muted-foreground">
                  {s.tracker.tv_symbol} · {s.tracker.tf}
                </div>
              </div>
              <button
                type="button"
                className="text-sm underline"
                onClick={() => setOpenFor(s.tracker)}
              >
                View analyses
              </button>
            </div>

            <div className="mt-3">
              <button
                type="button"
                className="text-xs text-red-500"
                onClick={async () => {
                  await fetch(`/api/tracker/coins/${s.tracker.id}`, {
                    method: "DELETE",
                  })
                  if (openFor?.id === s.tracker.id) setOpenFor(null)
                  refreshSubs()
                }}
              >
                Remove coin
              </button>
            </div>
          </div>
        ))}
      </div>

      {showAdd && (
        <AddCoinModal
          onClose={() => {
            setShowAdd(false)
            refreshSubs()
          }}
        />
      )}

      {openFor && (
        <AnalysesModal
          tracker={openFor}
          loading={loadingAnalyses}
          analyses={analyses}
          onClose={() => setOpenFor(null)}
        />
      )}
    </div>
  )
}

function AddCoinModal({ onClose }: { onClose: () => void }) {
  const [tvSymbol, setTvSymbol] = useState("BINANCE:BTCUSDT")
  const [displaySymbol, setDisplaySymbol] = useState("BTCUSDT")
  const [tf, setTf] = useState<"h1" | "h4" | "d1">("h1")
  const [saving, setSaving] = useState(false)

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl p-6 w-full max-w-md space-y-4">
        <h3 className="text-lg font-semibold">Add Coin</h3>

        <div className="space-y-2">
          <label className="text-sm">TradingView Symbol</label>
          <input
            className="w-full border rounded p-2"
            value={tvSymbol}
            onChange={(e) => setTvSymbol(e.target.value)}
            placeholder="BINANCE:BTCUSDT"
          />

          <label className="text-sm">Display Symbol</label>
          <input
            className="w-full border rounded p-2"
            value={displaySymbol}
            onChange={(e) => setDisplaySymbol(e.target.value)}
            placeholder="BTCUSDT"
          />

          <label className="text-sm">Timeframe</label>
          <select
            className="w-full border rounded p-2"
            value={tf}
            onChange={(e: React.ChangeEvent<HTMLSelectElement>) =>
              setTf(e.target.value as "h1" | "h4" | "d1")
            }
          >
            <option value="h1">1h</option>
            <option value="h4">4h</option>
            <option value="d1">1d</option>
          </select>
        </div>

        <div className="flex justify-end gap-2">
          <button type="button" className="px-3 py-2 rounded-lg border" onClick={onClose}>
            Cancel
          </button>

          <button
            type="button"
            className="px-3 py-2 rounded-lg border bg-black text-white"
            disabled={saving}
            onClick={async () => {
              setSaving(true)
              await fetch("/api/tracker/coins", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ tvSymbol, displaySymbol, tf }),
              })
              setSaving(false)
              onClose()
            }}
          >
            {saving ? "Saving..." : "Save"}
          </button>
        </div>
      </div>
    </div>
  )
}

function AnalysesModal({
  tracker,
  analyses,
  loading,
  onClose,
}: {
  tracker: { id: string; display_symbol: string; tf: "h1" | "h4" | "d1" }
  analyses: Analysis[]
  loading: boolean
  onClose: () => void
}) {
  return (
    <div className="fixed inset-0 bg-black/60 p-4 overflow-y-auto">
      <div className="mx-auto max-w-5xl bg-white rounded-2xl p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">
            {tracker.display_symbol} · {tracker.tf}
          </h3>
          <button type="button" className="px-3 py-1 rounded border" onClick={onClose}>
            Close
          </button>
        </div>

        {loading && (
          <div className="text-sm text-muted-foreground">Loading analyses…</div>
        )}

        {!loading && analyses.length === 0 && (
          <div className="text-sm text-muted-foreground">
            No analyses yet for this coin.
          </div>
        )}

        <div className="space-y-4">
          {analyses.map((a) => (
            <div key={a.id} className="grid md:grid-cols-2 gap-4 rounded-xl border p-4">
              <Image
                src={a.image_url}
                alt={`${tracker.display_symbol} chart`}
                width={1200}
                height={700}
                className="w-full h-auto rounded-lg"
              />
              <div className="whitespace-pre-wrap">{a.analysis_text}</div>
              <div className="md:col-span-2 text-xs text-muted-foreground">
                {new Date(a.created_at).toLocaleString()}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}