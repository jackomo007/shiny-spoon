"use client";

import { useEffect, useState } from "react";
import ChartWithOverlay from "@/components/tracker/ChartWithOverlay";
import Modal from "@/components/ui/Modal";

type Timeframe = "h1" | "h4" | "d1";

type Sub = {
  tracker: {
    id: string;
    tv_symbol: string;
    display_symbol: string;
    tf: Timeframe;
  };
};

type OverlaySnapshot = {
  symbol: string;
  exchange: string;
  timeframe: string;
  priceClose: number;
  priceDiff: number;
  pricePct: number;
  high: number;
  low: number;
  volumeLast: number;
  avgVol30: number;
  createdAt: string;
};

type Analysis = {
  id: string;
  image_url: string;
  analysis_text: string;
  created_at: string;
  overlay_snapshot?: OverlaySnapshot | null;
};

export default function ChartTrackerPage() {
  const [subs, setSubs] = useState<Sub[]>([]);
  const [openFor, setOpenFor] = useState<Sub["tracker"] | null>(null);
  const [analyses, setAnalyses] = useState<Analysis[]>([]);
  const [loadingAnalyses, setLoadingAnalyses] = useState(false);
  const [showAdd, setShowAdd] = useState(false);

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  async function refreshSubs() {
    const r = await fetch("/api/tracker/coins", { cache: "no-store" });
    if (r.ok) setSubs(await r.json());
  }

  async function refetchAnalyses(trackerId: string) {
    setLoadingAnalyses(true);
    try {
      const r = await fetch(
        `/api/tracker/analyses?trackerId=${encodeURIComponent(trackerId)}`,
        { cache: "no-store" }
      );
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const data: Analysis[] = await r.json();
      setAnalyses(data);
    } catch (err) {
      console.error("[ChartTracker] fetch analyses failed:", err);
      setAnalyses([]);
    } finally {
      setLoadingAnalyses(false);
    }
  }

  useEffect(() => {
    void refreshSubs();
  }, []);

  useEffect(() => {
    if (!openFor?.id) return;
    const ctrl = new AbortController();
    (async () => {
      try {
        setLoadingAnalyses(true);
        const r = await fetch(
          `/api/tracker/analyses?trackerId=${encodeURIComponent(openFor.id)}`,
          { signal: ctrl.signal, cache: "no-store" }
        );
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        const data: Analysis[] = await r.json();
        setAnalyses(data);
      } catch (err) {
        if ((err as Error).name !== "AbortError") {
          console.error("[ChartTracker] fetch analyses failed:", err);
          setAnalyses([]);
        }
      } finally {
        setLoadingAnalyses(false);
      }
    })();
    return () => ctrl.abort();
  }, [openFor?.id]);

  function askRemoveCoin(id: string) {
    setPendingDeleteId(id);
    setConfirmOpen(true);
  }

  async function confirmRemoveCoin() {
    if (!pendingDeleteId) return;
    try {
      setDeleting(true);
      await fetch(`/api/tracker/coins/${pendingDeleteId}`, { method: "DELETE" });
      if (openFor?.id === pendingDeleteId) setOpenFor(null);
      await refreshSubs();
      setConfirmOpen(false);
      setPendingDeleteId(null);
    } catch (e) {
      alert(e instanceof Error ? e.message : "Failed to remove coin");
    } finally {
      setDeleting(false);
    }
  }

  const hasCoins = subs.length > 0;

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

      {!hasCoins && (
        <div className="rounded-2xl border bg-white p-8 text-center">
          <div className="mx-auto mb-3 h-12 w-12 rounded-full bg-purple-100 grid place-items-center text-purple-600 text-xl">
            📈
          </div>
          <h3 className="text-lg font-semibold">Track your first coin</h3>
          <p className="text-sm text-gray-600 mt-1">
            Add a coin and timeframe. We’ll analyze the chart automatically and
            keep the latest 10 analyses.
          </p>
          <button
            className="mt-4 rounded-lg bg-black text-white px-4 py-2"
            onClick={() => setShowAdd(true)}
          >
            Add your first coin
          </button>
        </div>
      )}

      {hasCoins && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {subs.map((s) => (
            <div
              key={s.tracker.id}
              className="rounded-2xl p-4 border shadow hover:shadow-md transition bg-white"
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

              <div className="mt-3 flex items-center justify-between">
                <button
                  type="button"
                  className="text-xs text-red-500"
                  onClick={() => askRemoveCoin(s.tracker.id)}
                >
                  Remove coin
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {showAdd && (
        <AddCoinModal
          onClose={() => {
            setShowAdd(false);
            void refreshSubs();
          }}
        />
      )}

      {openFor && (
        <AnalysesModal
          tracker={openFor}
          loading={loadingAnalyses}
          analyses={analyses}
          onClose={() => setOpenFor(null)}
          onRefetch={() => openFor?.id && refetchAnalyses(openFor.id)}
        />
      )}

      <Modal
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        title="Remove coin?"
        footer={
          <div className="flex items-center justify-end gap-3">
            <button
              className="rounded-xl bg-gray-100 px-4 py-2 text-sm hover:bg-gray-200"
              onClick={() => setConfirmOpen(false)}
            >
              Cancel
            </button>
            <button
              onClick={confirmRemoveCoin}
              disabled={deleting}
              className="rounded-xl bg-orange-600 text-white px-4 py-2 text-sm hover:opacity-90 disabled:opacity-50"
            >
              {deleting ? "Removing…" : "Remove"}
            </button>
          </div>
        }
      >
        <div className="text-sm text-gray-600">
          This will stop future analyses for this coin unless you add it again.
        </div>
      </Modal>
    </div>
  );
}

function AddCoinModal({ onClose }: { onClose: () => void }) {
  const [tvSymbol, setTvSymbol] = useState("BINANCE:BTCUSDT");
  const [tf, setTf] = useState<Timeframe>("h1");
  const [saving, setSaving] = useState(false);

  function deriveDisplaySymbol(input: string) {
    const s = (input || "").trim().toUpperCase();
    const [, right] = s.split(":");
    return (right || s).replace(/\s+/g, "");
  }

  const canSave = (() => {
    const s = tvSymbol.trim().toUpperCase();
    if (!s.includes(":")) return false;
    const [, pair] = s.split(":");
    return (pair || "").length >= 2 && !saving;
  })();

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-2xl p-6 w-full max-w-md space-y-4">
        <h3 className="text-lg font-semibold">Add Coin</h3>

        <div className="space-y-2">
          <label className="text-sm">TradingView Symbol</label>
          <input
            className="w-full border rounded p-2"
            value={tvSymbol}
            onChange={(e) => setTvSymbol(e.target.value.toUpperCase())}
            placeholder="BINANCE:BTCUSDT"
          />

          <label className="text-sm">Timeframe</label>
          <select
            className="w-full border rounded p-2"
            value={tf}
            onChange={(e: React.ChangeEvent<HTMLSelectElement>) =>
              setTf(e.target.value as Timeframe)
            }
          >
            <option value="h1">1h</option>
            <option value="h4">4h</option>
            <option value="d1">1d</option>
          </select>
        </div>

        <div className="flex justify-end gap-2">
          <button
            type="button"
            className="px-3 py-2 rounded-lg border"
            onClick={onClose}
          >
            Cancel
          </button>

          <button
            type="button"
            className="px-3 py-2 rounded-lg border bg-black text-white disabled:opacity-50"
            disabled={!canSave}
            onClick={async () => {
              try {
                setSaving(true);

                const displaySymbol = deriveDisplaySymbol(tvSymbol);

                const body = {
                  tvSymbol: tvSymbol.trim().toUpperCase(),
                  displaySymbol,
                  tf,
                };

                const r = await fetch("/api/tracker/coins", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify(body),
                });
                if (!r.ok) {
                  const t = await r.text();
                  throw new Error(`HTTP ${r.status}${t ? ` - ${t}` : ""}`);
                }
                onClose();
              } catch (e) {
                alert(e instanceof Error ? e.message : "Failed to save");
              } finally {
                setSaving(false);
              }
            }}
          >
            {saving ? "Saving..." : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}

function AnalysesModal({
  tracker,
  analyses,
  loading,
  onClose,
  onRefetch,
}: {
  tracker: { id: string; display_symbol: string; tf: Timeframe };
  analyses: Analysis[];
  loading: boolean;
  onClose: () => void;
  onRefetch: () => void;
}) {
  return (
    <div className="fixed inset-0 bg-black/60 p-4 overflow-y-auto z-50">
      <div className="mx-auto max-w-5xl bg-white rounded-2xl p-0 md:p-6">
        <div className="flex items-center justify-between px-4 py-3 md:px-0 md:py-0 md:mb-4">
          <h3 className="text-lg font-semibold">
            {tracker.display_symbol} · {tracker.tf}
          </h3>
          <button
            type="button"
            className="px-3 py-1 rounded border"
            onClick={onClose}
          >
            Close
          </button>
        </div>

        {loading && (
          <div className="px-4 pb-4 md:px-0 text-sm text-muted-foreground">
            Loading analyses…
          </div>
        )}

        {!loading && analyses.length === 0 && (
          <div className="px-4 pb-4 md:px-0 text-sm text-muted-foreground">
            No analyses yet for this coin.
          </div>
        )}

        <div className="space-y-6 px-4 pb-6 md:px-0">
          {analyses.map((a) => (
            <div key={a.id} className="rounded-xl border overflow-hidden">
              <div className="bg-black/5">
                <ChartWithOverlay
                  imageUrl={a.image_url}
                  symbol={tracker.display_symbol}
                  timeframe={tracker.tf}
                  panelWidth={280}
                  title={`${tracker.display_symbol} · ${tracker.tf.toUpperCase()}`}
                  snapshot={a.overlay_snapshot ?? undefined}
                />
              </div>

              <div className="p-4 md:p-6">
                <div className="whitespace-pre-wrap leading-relaxed">
                  {a.analysis_text}
                </div>
                <div className="mt-3 text-xs text-muted-foreground">
                  {new Date(a.created_at).toLocaleString()}
                </div>

                <div className="mt-4">
                  <button
                    className="text-sm underline"
                    onClick={async () => {
                      await onRefetch();
                      try {
                        (document.activeElement as HTMLElement | null)?.blur();
                      } catch {}
                    }}
                  >
                    Refresh analysis list
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
