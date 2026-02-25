"use client";

import { useEffect, useMemo, useState } from "react";
import Modal from "@/components/ui/Modal";
import AssetMultiSelect, {
  type CoinSelection,
} from "@/components/trade-analyzer/AssetMultiSelect";

type StrategyType = "percentage";

type ExitStrategyAssetSummary = {
  coinSymbol: string;
  qtyOpen: number;
  entryPriceUsd: number;
  currentPriceUsd: number;
  currentPriceSource: "binance" | "coingecko" | "db_cache" | "avg_entry";
  currentPriceIsEstimated: boolean;
  nextGainPercent: number;
  targetPriceUsd: number;
  qtyToSell: number;
  usdValueToSell: number;
  distanceToTargetPercent: number;
  status: "pending" | "ready";
};

type ExitStrategySummary = {
  id: string;
  isAllCoins: boolean;
  coinSymbols: string[];
  strategyType: StrategyType;
  sellPercent: number;
  gainPercent: number;
  isActive: boolean;
  assets: ExitStrategyAssetSummary[];
  totalAssets: number;
  totalProfitUsd: number;
};

type ExitStrategyStepRow = {
  gainPercent: number;
  targetPriceUsd: number;
  plannedQtyToSell: number;
  executedQtyToSell: number | null;
  proceedsUsd: number;
  remainingQtyAfter: number;
  realizedProfitUsd: number;
  cumulativeRealizedProfitUsd: number;
  isExecuted?: boolean;
};

type Details = {
  summary: ExitStrategySummary;
  rowsByCoin: Record<string, ExitStrategyStepRow[]>;
};

type CoinSimResult = {
  coinSymbol: string;
  qtyOpen: number;
  entryPriceUsd: number;
  rows: ExitStrategyStepRow[];
};

function usd(n: number | null | undefined) {
  const v = typeof n === "number" && !Number.isNaN(n) ? n : 0;
  return v.toLocaleString(undefined, { style: "currency", currency: "USD" });
}

function num(n: number, d = 2) {
  if (!Number.isFinite(n)) return "-";
  return n.toLocaleString(undefined, { maximumFractionDigits: d });
}

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

function ScaleOutPlanTable({ rows }: { rows: ExitStrategyStepRow[] }) {
  return (
    <div className="rounded-xl border bg-white overflow-x-auto overflow-y-auto max-h-[45vh]">
      <table className="w-full text-sm">
        <thead className="border-b bg-gray-50 sticky top-0 z-10">
          <tr className="text-left text-gray-600">
            <th className="px-4 py-3">Gain</th>
            <th className="px-4 py-3">Target Price</th>
            <th className="px-4 py-3">Qty Sold</th>
            <th className="px-4 py-3">Proceeds</th>
            <th className="px-4 py-3">Remaining</th>
            <th className="px-4 py-3">Profit</th>
            <th className="px-4 py-3">Cumulative Profit</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const qtySold = r.executedQtyToSell ?? r.plannedQtyToSell;
            return (
              <tr key={r.gainPercent} className="border-b last:border-b-0">
                <td className="px-4 py-3">+{num(r.gainPercent, 0)}%</td>
                <td className="px-4 py-3">{usd(r.targetPriceUsd)}</td>
                <td className="px-4 py-3">
                  {num(qtySold, 8).replace(/\.?0+$/, "")}
                </td>
                <td className="px-4 py-3">{usd(r.proceedsUsd)}</td>
                <td className="px-4 py-3">
                  {num(r.remainingQtyAfter, 8).replace(/\.?0+$/, "")}
                </td>
                <td className="px-4 py-3">{usd(r.realizedProfitUsd)}</td>
                <td className="px-4 py-3">
                  {usd(r.cumulativeRealizedProfitUsd)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

const PREVIEW_LIMIT = 3;

function StrategyCard({
  s,
  onView,
  onDelete,
  deletingId,
}: {
  s: ExitStrategySummary;
  onView: (id: string) => void;
  onDelete: (id: string, label: string) => void;
  deletingId: string | null;
}) {
  const label = s.isAllCoins ? "All Coins" : s.coinSymbols.join(", ");
  const strategyName = `Sell ${num(s.sellPercent, 0)}% Every ${num(s.gainPercent, 0)}% Gain`;
  const previewAssets = s.assets.slice(0, PREVIEW_LIMIT);
  const hiddenCount = s.assets.length - PREVIEW_LIMIT;

  return (
    <div className="rounded-2xl border bg-white overflow-hidden">
      <div className="px-5 pt-5 pb-4 flex items-start justify-between gap-4">
        <div>
          <div className="text-base font-semibold text-gray-900">
            {strategyName}
          </div>
          <div className="text-sm text-gray-500 mt-0.5">
            Applies to:{" "}
            <span className="font-medium text-gray-700">
              {s.totalAssets} {s.totalAssets === 1 ? "asset" : "assets"}
            </span>
            {" · "}
            Total Profit:{" "}
            <span className="font-medium text-gray-700">
              {usd(s.totalProfitUsd)}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            className="h-9 px-4 rounded-xl bg-purple-600 text-white text-sm hover:bg-purple-700"
            onClick={() => onView(s.id)}
            type="button"
          >
            View
          </button>
          <button
            className="h-9 w-9 rounded-xl border bg-white text-gray-400 hover:text-red-500 hover:border-red-200 hover:bg-red-50 disabled:opacity-50 flex items-center justify-center transition-colors"
            onClick={() => onDelete(s.id, label)}
            aria-label="Delete strategy"
            title="Delete"
            type="button"
            disabled={deletingId === s.id}
          >
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
              />
            </svg>
          </button>
        </div>
      </div>

      {s.assets.length > 0 && (
        <>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-t border-b bg-gray-50">
                <tr className="text-left text-gray-500 text-xs uppercase tracking-wide">
                  <th className="px-5 py-2.5">Asset</th>
                  <th className="px-5 py-2.5">Next Sell</th>
                  <th className="px-5 py-2.5">Target Price</th>
                  <th className="px-5 py-2.5">Distance</th>
                  <th className="px-5 py-2.5">Progress</th>
                  <th className="px-5 py-2.5">Actions</th>
                </tr>
              </thead>
              <tbody>
                {previewAssets.map((asset) => {
                  const distance = clamp(asset.distanceToTargetPercent, 0, 100);
                  const progress = 100 - distance;
                  const isReady = asset.status === "ready";

                  return (
                    <tr
                      key={asset.coinSymbol}
                      className="border-b last:border-b-0 hover:bg-gray-50"
                    >
                      <td className="px-5 py-3 font-medium text-gray-900">
                        {asset.coinSymbol}
                      </td>
                      <td className="px-5 py-3 text-gray-700">
                        <div>Sell {num(s.sellPercent, 0)}%</div>
                        <div className="text-xs text-gray-500">
                          {num(asset.qtyToSell, 8).replace(/\.?0+$/, "")}{" "}
                          {asset.coinSymbol} ({usd(asset.usdValueToSell)})
                        </div>
                      </td>
                      <td className="px-5 py-3 text-gray-700">
                        ${Number(asset.targetPriceUsd).toFixed(3)}
                        <span className="text-xs text-gray-500 ml-1">
                          (+{num(asset.nextGainPercent, 0)}%)
                        </span>
                      </td>
                      <td className="px-5 py-3 text-gray-700">
                        {num(asset.distanceToTargetPercent, 2)}%
                      </td>
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-2">
                          <div className="w-24 h-2 rounded-full bg-gray-100 overflow-hidden">
                            <div
                              className="h-full rounded-full bg-purple-600"
                              style={{ width: `${progress.toFixed(2)}%` }}
                            />
                          </div>
                          <span className="text-xs text-gray-500">
                            {progress.toFixed(0)}%
                          </span>
                        </div>
                      </td>
                      <td className="px-5 py-3">
                        <span
                          className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                            isReady
                              ? "bg-purple-100 text-purple-700"
                              : "bg-gray-100 text-gray-600"
                          }`}
                        >
                          {isReady ? "Ready" : "Pending"}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="px-5 py-3 border-t bg-gray-50 flex items-center justify-between">
            {hiddenCount > 0 ? (
              <span className="text-xs text-gray-500">
                +{hiddenCount} more {hiddenCount === 1 ? "asset" : "assets"}
              </span>
            ) : (
              <span />
            )}
            <button
              type="button"
              className="text-sm text-purple-600 hover:text-purple-700 font-medium flex items-center gap-1"
              onClick={() => onView(s.id)}
            >
              View All
              <svg
                className="w-3.5 h-3.5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 5l7 7-7 7"
                />
              </svg>
            </button>
          </div>
        </>
      )}
    </div>
  );
}

export default function ExitStrategyPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<ExitStrategySummary[]>([]);

  const [addOpen, setAddOpen] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);

  const [details, setDetails] = useState<Details | null>(null);

  const [confirmDelete, setConfirmDelete] = useState<null | {
    id: string;
    label: string;
  }>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const [coinSelection, setCoinSelection] = useState<CoinSelection>([]);
  const [strategyType, setStrategyType] = useState<StrategyType>("percentage");
  const [sellPercent, setSellPercent] = useState(25);
  const [gainPercent, setGainPercent] = useState(30);

  const [addError, setAddError] = useState<string | null>(null);
  const [simLoading, setSimLoading] = useState(false);
  const [simError, setSimError] = useState<string | null>(null);
  const [simResults, setSimResults] = useState<CoinSimResult[] | null>(null);

  const canSimulate = useMemo(() => {
    if (strategyType !== "percentage") return false;
    if (coinSelection === "all") return true;
    return coinSelection.length > 0;
  }, [strategyType, coinSelection]);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/exit-strategies", { cache: "no-store" });
      if (!res.ok) {
        const j = (await res
          .json()
          .catch(() => ({}) as { error?: string })) as { error?: string };
        throw new Error(j.error || `HTTP ${res.status}`);
      }
      const json = (await res.json()) as { data: ExitStrategySummary[] };
      setItems(json.data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  useEffect(() => {
    if (!addOpen) {
      setAddError(null);
      setSimError(null);
      setSimResults(null);
      setSimLoading(false);
      setCoinSelection([]);
    }
  }, [addOpen]);

  const openDetails = async (id: string) => {
    setDetails(null);
    setDetailsOpen(true);
    setError(null);

    try {
      const res = await fetch(
        `/api/exit-strategies/${encodeURIComponent(id)}`,
        { cache: "no-store" },
      );
      if (!res.ok) {
        const j = (await res
          .json()
          .catch(() => ({}) as { error?: string })) as { error?: string };
        throw new Error(j.error || `HTTP ${res.status}`);
      }
      const json = (await res.json()) as { data: Details };
      setDetails(json.data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load details");
    }
  };

  const createStrategy = async () => {
    setError(null);
    setAddError(null);

    if (coinSelection !== "all" && coinSelection.length === 0) {
      setAddError("Please select at least one coin.");
      return;
    }

    try {
      const body =
        coinSelection === "all"
          ? { allCoins: true, strategyType, sellPercent, gainPercent }
          : {
              allCoins: false,
              coinSymbols: coinSelection,
              strategyType,
              sellPercent,
              gainPercent,
            };

      const res = await fetch("/api/exit-strategies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const j = (await res
          .json()
          .catch(() => ({}) as { error?: string })) as { error?: string };
        if (res.status === 409) {
          setAddError(
            j.error || "An exit strategy for one or more coins already exists.",
          );
          return;
        }
        throw new Error(j.error || "Operation failed");
      }

      setAddOpen(false);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to create");
    }
  };

  const simulatePlan = async () => {
    setSimLoading(true);
    setSimError(null);
    setSimResults(null);

    try {
      const body =
        coinSelection === "all"
          ? { allCoins: true, sellPercent, gainPercent, maxSteps: 10 }
          : {
              allCoins: false,
              coinSymbols: coinSelection,
              sellPercent,
              gainPercent,
              maxSteps: 10,
            };

      const res = await fetch("/api/exit-strategies/simulate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const j = (await res
          .json()
          .catch(() => ({}) as { error?: string })) as { error?: string };
        throw new Error(j.error || `HTTP ${res.status}`);
      }

      const json = (await res.json()) as { data: { results: CoinSimResult[] } };
      setSimResults(json.data.results);
    } catch (e) {
      setSimError(e instanceof Error ? e.message : "Failed to simulate");
    } finally {
      setSimLoading(false);
    }
  };

  const requestDelete = (id: string, label: string) =>
    setConfirmDelete({ id, label });

  const confirmDeleteNow = async () => {
    if (!confirmDelete) return;
    const { id } = confirmDelete;

    setDeletingId(id);
    setError(null);

    try {
      const res = await fetch(
        `/api/exit-strategies/${encodeURIComponent(id)}`,
        { method: "DELETE" },
      );
      if (!res.ok && res.status !== 204) {
        const j = (await res
          .json()
          .catch(() => ({}) as { error?: string })) as { error?: string };
        throw new Error(j.error || `Failed (${res.status})`);
      }
      setConfirmDelete(null);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to delete");
    } finally {
      setDeletingId(null);
    }
  };

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Exit Strategy</h1>
          <p className="text-sm text-gray-500">
            Execution-ready scale-out plans for your portfolio.
          </p>
        </div>
        <button
          className="px-4 py-2 rounded-xl bg-purple-600 text-white hover:bg-purple-700"
          onClick={() => {
            setAddError(null);
            setAddOpen(true);
          }}
          type="button"
        >
          + Add Strategy
        </button>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-red-50 text-red-700 border border-red-200">
          {error}
        </div>
      )}

      {loading ? (
        <div className="space-y-4">
          {[1, 2].map((i) => (
            <div
              key={i}
              className="h-[180px] w-full rounded-2xl bg-gray-100 animate-pulse"
            />
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-2xl border bg-white p-6 text-sm text-gray-600">
          No exit strategies yet. Click <b>Add Strategy</b> to create one.
        </div>
      ) : (
        <div className="grid gap-4">
          {items.map((s) => (
            <StrategyCard
              key={s.id}
              s={s}
              onView={(id) => void openDetails(id)}
              onDelete={requestDelete}
              deletingId={deletingId}
            />
          ))}
        </div>
      )}

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
                disabled={simLoading || !canSimulate}
                title="Preview the plan without saving"
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
          <div className="max-h-[70vh] overflow-y-auto pr-2">
            <div className="grid gap-3">
              {addError && (
                <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {addError}
                </div>
              )}

              <div className="grid gap-1">
                <div className="text-xs text-gray-500">Coins</div>
                <AssetMultiSelect
                  value={coinSelection}
                  onChange={setCoinSelection}
                />
              </div>

              <label className="grid gap-1">
                <span className="text-xs text-gray-500">Strategy Type</span>
                <select
                  className="w-full rounded-xl border border-gray-200 px-3 py-2"
                  value={strategyType}
                  onChange={(e) =>
                    setStrategyType(e.target.value as StrategyType)
                  }
                >
                  <option value="percentage">Percentage Based</option>
                </select>
              </label>

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

              {simError && (
                <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {simError}
                </div>
              )}

              {simResults && simResults.length > 0 && (
                <div className="mt-2 grid gap-4">
                  {simResults.map((result) => (
                    <div key={result.coinSymbol}>
                      {simResults.length > 1 && (
                        <div className="text-sm font-medium text-gray-700 mb-1">
                          {result.coinSymbol}
                        </div>
                      )}
                      <ScaleOutPlanTable rows={result.rows} />
                    </div>
                  ))}
                </div>
              )}
            </div>
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
            Are you sure you want to delete the exit strategy for{" "}
            <b>{confirmDelete.label}</b>?
            <div className="mt-2 text-xs text-gray-500">
              This will also remove its execution history.
            </div>
          </div>
        </Modal>
      )}

      {detailsOpen && (
        <Modal
          open
          widthClass="max-w-5xl"
          onClose={() => {
            setDetailsOpen(false);
            setDetails(null);
          }}
          title={
            details?.summary
              ? `${details.summary.isAllCoins ? "All Coins" : details.summary.coinSymbols.join(", ")} – Scale-Out Plan`
              : "Loading…"
          }
          footer={
            <div className="flex items-center justify-end gap-3">
              <button
                className="rounded-xl bg-purple-600 text-white px-4 py-2 text-sm hover:bg-purple-700"
                onClick={() => {
                  setDetailsOpen(false);
                  setDetails(null);
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
            <div className="grid gap-6">
              {Object.entries(details.rowsByCoin).map(([coin, rows]) => (
                <div key={coin}>
                  {Object.keys(details.rowsByCoin).length > 1 && (
                    <div className="text-sm font-medium text-gray-700 mb-2">
                      {coin}
                    </div>
                  )}
                  <ScaleOutPlanTable rows={rows} />
                </div>
              ))}
            </div>
          )}
        </Modal>
      )}
    </div>
  );
}
