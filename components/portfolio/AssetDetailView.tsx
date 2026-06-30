"use client";

import { useState, useEffect, useCallback } from "react";
import Card from "@/components/ui/Card";
import Modal from "@/components/ui/Modal";
import { Table, Th, Tr, Td } from "@/components/ui/Table";
import { usd, pct, qty, cls } from "@/components/portfolio/format";
import { CoinBadge } from "@/components/portfolio/CoinBadge";
import AddTransactionModal from "@/components/portfolio/AddTransactionModal";
import type { TxRow } from "@/components/portfolio/TransactionsTable";

type AssetDetail = {
  symbol: string;
  name: string | null;
  iconUrl: string | null;
  balance: {
    quantity: number;
    valueUsd: number;
  };
  metrics: {
    currentPrice: number;
    change24h: {
      usd: number;
      pct: number | null;
    };
    totalProfit: {
      usd: number;
      pct: number;
    };
    realizedProfit: number;
    unrealizedProfit: number;
    avgBuyPrice: number;
    totalInvested: number;
  };
  keyLevels: {
    supports: Array<{ price: number; distance: string; timeframe: string }>;
    resistances: Array<{ price: number; distance: string; timeframe: string }>;
  };
  transactions: Array<{
    id: string;
    side: "buy" | "sell";
    executedAt: string;
    qty: number;
    priceUsd: number;
    totalUsd: number;
    feeUsd: number;
    gainLossUsd: number | null;
    gainLossPct: number | null;
  }>;
};

type Props = {
  symbol: string;
  onBack: () => void;
  onPortfolioChange?: () => Promise<void>;
};

type ExitStrategyAssetSummary = {
  coinSymbol: string;
  qtyOpen: number;
  entryPriceUsd: number;
  currentPriceUsd: number;
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
  strategyType: "percentage";
  sellPercent: number;
  gainPercent: number;
  startingQuantity: number | null;
  assets: ExitStrategyAssetSummary[];
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
};

const DEFAULT_SELL_PERCENT = 25;
const DEFAULT_GAIN_PERCENT = 30;

function num(n: number | null | undefined, digits = 2) {
  if (n == null || !Number.isFinite(n)) return "-";
  return n.toLocaleString("en-US", { maximumFractionDigits: digits });
}

function signedPct(n: number | null | undefined, digits = 2) {
  if (n == null || !Number.isFinite(n)) return "-";
  return `${n >= 0 ? "+" : ""}${n.toFixed(digits)}%`;
}

function round(n: number, digits: number) {
  const p = 10 ** digits;
  return Math.round(n * p) / p;
}

function buildSuggestedRows(
  qtyOpen: number,
  avgEntryPrice: number,
  sellPercent: number,
  gainPercent: number,
  currentPriceUsd: number,
  maxSteps = 6,
): ExitStrategyStepRow[] {
  let remaining = qtyOpen;
  let cumulative = 0;
  const sellPct = sellPercent / 100;
  const maxTargetPrice = currentPriceUsd > 0 ? currentPriceUsd * 6 : Infinity;

  return Array.from({ length: maxSteps }).flatMap((_, i) => {
    if (remaining <= 0) return [];

    const gain = round(gainPercent * (i + 1), 2);
    const target = avgEntryPrice > 0 ? avgEntryPrice * (1 + gain / 100) : 0;
    if (target > maxTargetPrice) return [];

    const plannedQty = remaining * sellPct;
    const proceeds = plannedQty * target;
    const profit = plannedQty * (target - avgEntryPrice);

    remaining = Math.max(remaining - plannedQty, 0);
    cumulative += profit;

    return [
      {
        gainPercent: gain,
        targetPriceUsd: round(target, 8),
        plannedQtyToSell: round(plannedQty, 8),
        executedQtyToSell: null,
        proceedsUsd: round(proceeds, 2),
        remainingQtyAfter: round(remaining, 8),
        realizedProfitUsd: round(profit, 2),
        cumulativeRealizedProfitUsd: round(cumulative, 2),
      },
    ];
  });
}

function ScaleOutPlanList({
  rows,
  symbol,
  onLoadMore,
  completedLevels,
  onToggleLevel,
}: {
  rows: ExitStrategyStepRow[];
  symbol: string;
  onLoadMore?: () => void;
  completedLevels?: Record<string, boolean>;
  onToggleLevel?: (levelKey: string) => void;
}) {
  function handleScroll(e: React.UIEvent<HTMLDivElement>) {
    if (!onLoadMore) return;
    const el = e.currentTarget;
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    if (distanceFromBottom <= 24) onLoadMore();
  }

  return (
    <div className="max-h-[332px] overflow-y-auto pr-1" onScroll={handleScroll}>
      <div className="grid gap-2.5">
        {rows.map((row) => {
          const levelKey = row.gainPercent.toFixed(2);
          const isCompleted = !!completedLevels?.[levelKey];
          const canToggle = !!onToggleLevel;

          return (
            <div
              key={row.gainPercent}
              className={cls(
                "grid items-center gap-3 rounded-[10px] border border-slate-200 bg-slate-50 px-3 py-3",
                canToggle
                  ? "grid-cols-[auto_78px_1fr_auto]"
                  : "grid-cols-[78px_1fr_auto]",
                isCompleted &&
                  "border-slate-200 border-l-4 border-l-emerald-500 bg-white",
              )}
            >
              {canToggle ? (
                <input
                  type="checkbox"
                  aria-label={`Mark ${signedPct(row.gainPercent, 0)} scale out as complete`}
                  className="h-4 w-4 rounded border-slate-300 accent-emerald-600"
                  checked={isCompleted}
                  onChange={() => onToggleLevel?.(levelKey)}
                />
              ) : null}

              <div
                className={cls(
                  "inline-flex h-7 items-center justify-center rounded-full bg-[#eef3fb] px-2.5 text-[11px] font-bold text-[#4f7bb8]",
                  isCompleted && "bg-emerald-50 text-emerald-700",
                )}
              >
                {signedPct(row.gainPercent, 0)}
              </div>

              <div
                className={cls(isCompleted && "text-slate-500")}
              >
                <div className="text-[10px] font-bold text-slate-600">
                  Scale Out
                </div>
                <div
                  className={cls(
                    "text-lg font-bold leading-tight tracking-normal text-slate-950",
                    isCompleted && "text-slate-600",
                  )}
                >
                  {usd(row.targetPriceUsd)}
                </div>
                <div className="mt-0.5 text-[10px] text-slate-600">
                  Estimated sell:{" "}
                  {qty(row.executedQtyToSell ?? row.plannedQtyToSell)} {symbol}
                </div>
              </div>

              <div
                className={cls(
                  "text-right",
                  isCompleted && "text-slate-500",
                )}
              >
                {isCompleted ? (
                  <div className="mb-1 inline-flex rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700">
                    Completed
                  </div>
                ) : null}
                <div>
                  <div className="mb-0.5 text-[10px] text-slate-600">
                    Estimated Cumulative Profit
                  </div>
                  <div className="text-[13px] font-bold">
                    {usd(row.cumulativeRealizedProfitUsd)}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function AssetDetailView({
  symbol,
  onBack,
  onPortfolioChange,
}: Props) {
  const [data, setData] = useState<AssetDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [transactionModalOpen, setTransactionModalOpen] = useState(false);
  const [transactionMode, setTransactionMode] = useState<"add" | "edit">(
    "add",
  );
  const [selectedTx, setSelectedTx] = useState<TxRow | null>(null);
  const [strategies, setStrategies] = useState<ExitStrategySummary[]>([]);
  const [strategyLoading, setStrategyLoading] = useState(true);
  const [strategyError, setStrategyError] = useState<string | null>(null);
  const [strategyModalOpen, setStrategyModalOpen] = useState(false);
  const [sellPercent, setSellPercent] = useState(DEFAULT_SELL_PERCENT);
  const [gainPercent, setGainPercent] = useState(DEFAULT_GAIN_PERCENT);
  const [savingStrategy, setSavingStrategy] = useState(false);
  const [startingQuantity, setStartingQuantity] = useState(0);
  const [planStepCount, setPlanStepCount] = useState(6);
  const [modalPlanStepCount, setModalPlanStepCount] = useState(6);
  const [completedScaleOutLevels, setCompletedScaleOutLevels] = useState<
    Record<string, boolean>
  >({});

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/portfolio/${symbol}`, {
        cache: "no-store",
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const j = (await res.json()) as AssetDetail;
      setData(j);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, [symbol]);

  const loadStrategies = useCallback(async () => {
    setStrategyLoading(true);
    setStrategyError(null);
    try {
      const res = await fetch("/api/exit-strategies", { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = (await res.json()) as { data: ExitStrategySummary[] };
      setStrategies(json.data ?? []);
    } catch (e) {
      setStrategyError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setStrategyLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  useEffect(() => {
    void loadStrategies();
  }, [loadStrategies]);

  const activeStrategy =
    strategies.find(
      (s) =>
        !s.isAllCoins &&
        s.coinSymbols.some(
          (coin) => coin.toUpperCase() === symbol.toUpperCase(),
        ),
    ) ??
    strategies.find((s) =>
      s.assets.some(
        (asset) => asset.coinSymbol.toUpperCase() === symbol.toUpperCase(),
      ),
    ) ??
    null;

  const scaleOutStorageKey = [
    "portfolio-scale-out",
    symbol.toUpperCase(),
    activeStrategy?.id ?? "default",
    activeStrategy?.sellPercent ?? DEFAULT_SELL_PERCENT,
    activeStrategy?.gainPercent ?? DEFAULT_GAIN_PERCENT,
  ].join(":");

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(scaleOutStorageKey);
      const parsed = raw ? (JSON.parse(raw) as unknown) : {};
      setCompletedScaleOutLevels(
        parsed && typeof parsed === "object" && !Array.isArray(parsed)
          ? (parsed as Record<string, boolean>)
          : {},
      );
    } catch {
      setCompletedScaleOutLevels({});
    }
  }, [scaleOutStorageKey]);

  function toggleScaleOutLevel(levelKey: string) {
    setCompletedScaleOutLevels((current) => {
      const next = { ...current, [levelKey]: !current[levelKey] };
      if (!next[levelKey]) delete next[levelKey];

      try {
        window.localStorage.setItem(scaleOutStorageKey, JSON.stringify(next));
      } catch {
        // Visual reminder only; ignore storage failures.
      }

      return next;
    });
  }

  function convertToTxRow(tx: AssetDetail["transactions"][0]): TxRow {
    return {
      id: tx.id,
      symbol: data?.symbol ?? symbol,
      name: data?.name ?? symbol,
      iconUrl: data?.iconUrl ?? null,
      side: tx.side,
      executedAt: tx.executedAt,
      qty: tx.qty,
      priceUsd: tx.priceUsd,
      totalUsd: tx.totalUsd,
      feeUsd: tx.feeUsd,
      gainLossUsd: tx.gainLossUsd,
      gainLossPct: tx.gainLossPct,
    };
  }

  function handleEditTransaction(tx: AssetDetail["transactions"][0]) {
    setSelectedTx(convertToTxRow(tx));
    setTransactionMode("edit");
    setTransactionModalOpen(true);
  }

  function closeTransactionModal() {
    setTransactionModalOpen(false);
    setSelectedTx(null);
  }

  async function handleTransactionUpdated() {
    closeTransactionModal();
    await loadData();
    await loadStrategies();
    await onPortfolioChange?.();
  }

  if (loading) {
    return (
      <Card className="p-6">
        <div>Loading {symbol} details...</div>
      </Card>
    );
  }

  if (error || !data) {
    return (
      <Card className="p-6 text-red-600">
        {error || "Failed to load asset details"}
      </Card>
    );
  }

  const change24Up = (data.metrics.change24h.pct ?? 0) >= 0;
  const totalProfitUp = data.metrics.totalProfit.usd >= 0;
  const unrealizedUp = data.metrics.unrealizedProfit >= 0;
  const realizedUp = data.metrics.realizedProfit >= 0;

  function badgeModeForTx(
    tx: AssetDetail["transactions"][0],
  ): "coin" | "win" | "loss" {
    if (tx.gainLossUsd == null) return "coin";
    return tx.gainLossUsd >= 0 ? "win" : "loss";
  }

  const planRows = buildSuggestedRows(
    activeStrategy?.startingQuantity ?? data.balance.quantity,
    data.metrics.avgBuyPrice,
    activeStrategy?.sellPercent ?? DEFAULT_SELL_PERCENT,
    activeStrategy?.gainPercent ?? DEFAULT_GAIN_PERCENT,
    data.metrics.currentPrice,
    planStepCount,
  );
  const canLoadMorePlanRows = planRows.length === planStepCount;

  const modalPlanRows = buildSuggestedRows(
    startingQuantity,
    data.metrics.avgBuyPrice,
    sellPercent,
    gainPercent,
    data.metrics.currentPrice,
    modalPlanStepCount,
  );
  const canLoadMoreModalPlanRows = modalPlanRows.length === modalPlanStepCount;

  function openStrategyModal() {
    if (!data) return;
    setSellPercent(activeStrategy?.sellPercent ?? DEFAULT_SELL_PERCENT);
    setGainPercent(activeStrategy?.gainPercent ?? DEFAULT_GAIN_PERCENT);
    setStartingQuantity(activeStrategy?.startingQuantity ?? data.balance.quantity);
    setModalPlanStepCount(6);
    setStrategyError(null);
    setStrategyModalOpen(true);
  }

  async function saveStrategy() {
    setSavingStrategy(true);
    setStrategyError(null);

    try {
      const body = {
        strategyType: "percentage" as const,
        sellPercent,
        gainPercent,
        startingQuantity,
      };
      const res = activeStrategy
        ? await fetch(`/api/exit-strategies/${activeStrategy.id}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
          })
        : await fetch("/api/exit-strategies", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              allCoins: false,
              coinSymbols: [symbol],
              ...body,
            }),
          });

      if (!res.ok) {
        const j = (await res.json().catch(() => null)) as {
          error?: unknown;
        } | null;
        throw new Error(
          typeof j?.error === "string" ? j.error : "Failed to save",
        );
      }

      setStrategyModalOpen(false);
      await loadStrategies();
      await onPortfolioChange?.();
    } catch (e) {
      setStrategyError(e instanceof Error ? e.message : "Failed to save");
    } finally {
      setSavingStrategy(false);
    }
  }

  return (
    <>
      <div>
        <div className="flex items-center justify-between mb-6">
          <button
            onClick={onBack}
            className="flex items-center gap-2 text-slate-700 hover:text-slate-900 font-semibold text-lg"
          >
            <span className="text-2xl text-slate-400">‹</span> Back
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          <Card className="p-6">
            <div className="text-[13px] font-bold text-slate-400">
              {symbol} Balance
            </div>

            <div className="mt-4 flex items-center justify-between rounded-[14px] border border-slate-200 bg-slate-50 px-5 py-4">
              <div className="grid gap-1">
                <div className="text-[11px] font-bold uppercase tracking-[0.04em] text-slate-500">
                  Portfolio Value
                </div>
                <div className="text-2xl font-bold tracking-normal text-slate-950">
                  {usd(data.balance.valueUsd)}
                </div>
                <div className="text-xs font-bold text-slate-600">
                  {data.balance.quantity.toFixed(4)} {symbol}
                </div>
              </div>
              <div
                className={cls(
                  "grid justify-items-end gap-1 rounded-xl border px-3.5 py-2.5",
                  totalProfitUp
                    ? "border-emerald-200 bg-emerald-50"
                    : "border-red-200 bg-red-50",
                )}
              >
                <div
                  className={cls(
                    "text-[10px] font-bold uppercase tracking-[0.03em]",
                    totalProfitUp ? "text-emerald-700" : "text-red-700",
                  )}
                >
                  Total Return
                </div>
                <div
                  className={cls(
                    "text-base font-bold",
                    totalProfitUp ? "text-emerald-600" : "text-red-600",
                  )}
                >
                  {signedPct(data.metrics.totalProfit.pct)}
                </div>
              </div>
            </div>

            <div className="border-t border-slate-200 my-4" />

            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3.5">
                <div className="mb-1.5 text-[11px] font-bold text-slate-400">
                  Market Price
                </div>
                <div
                  className={cls(
                    "text-[15px] font-bold",
                    change24Up ? "text-emerald-600" : "text-red-600",
                  )}
                >
                  {usd(data.metrics.currentPrice)}
                </div>
                <div
                  className={cls(
                    "text-[11px] font-bold",
                    change24Up ? "text-emerald-600" : "text-red-600",
                  )}
                >
                  {signedPct(data.metrics.change24h.pct ?? 0)}
                </div>
              </div>

              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3.5">
                <div className="mb-1.5 flex items-center gap-1 text-[11px] font-bold text-slate-400">
                  Unrealized Gain <span className="text-slate-300">ⓘ</span>
                </div>
                <div
                  className={cls(
                    "text-[15px] font-bold",
                    unrealizedUp ? "text-orange-500" : "text-red-600",
                  )}
                >
                  {usd(data.metrics.unrealizedProfit)}
                </div>
              </div>

              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3.5">
                <div className="mb-1.5 flex items-center gap-1 text-[11px] font-bold text-slate-400">
                  Realized Gain <span className="text-slate-300">ⓘ</span>
                </div>
                <div
                  className={cls(
                    "text-[15px] font-bold",
                    realizedUp ? "text-emerald-600" : "text-red-600",
                  )}
                >
                  {usd(data.metrics.realizedProfit)}
                </div>
              </div>

              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3.5">
                <div className="mb-1.5 text-[11px] font-bold text-slate-400">
                  Avg. Buy Price
                </div>
                <div className="text-[15px] font-bold">
                  {usd(data.metrics.avgBuyPrice)}
                </div>
              </div>

              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3.5">
                <div className="mb-1.5 text-[11px] font-bold text-slate-400">
                  Total Invested
                </div>
                <div className="text-[15px] font-bold">
                  {usd(data.metrics.totalInvested)}
                </div>
              </div>
            </div>
          </Card>

          <Card className="p-6 flex flex-col">
            <div className="mb-4 flex gap-2.5">
              <button
                className="h-10 rounded-[10px] border border-slate-950 bg-slate-950 px-4 text-xs font-bold text-white"
                type="button"
              >
                Scale Out Plan
              </button>
            </div>

            <div className="mb-4 flex items-start justify-between gap-4">
              <div>
                <div className="mb-1 text-base font-extrabold">
                  Suggested Scale Out Plan
                </div>
                <div className="text-xs font-semibold text-slate-500">
                  Strategy: Sell{" "}
                  {num(activeStrategy?.sellPercent ?? DEFAULT_SELL_PERCENT, 0)}
                  % of your remaining position every{" "}
                  {num(activeStrategy?.gainPercent ?? DEFAULT_GAIN_PERCENT, 0)}
                  % gain.
                </div>
              </div>
              <button
                className="rounded-full bg-[#5801cc] px-4 py-2.5 text-xs font-bold text-white hover:bg-[#4d01b3]"
                onClick={openStrategyModal}
                type="button"
              >
                Change Plan
              </button>
            </div>

            {strategyLoading ? (
              <div className="text-sm text-slate-500">Loading plan...</div>
            ) : strategyError ? (
              <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {strategyError}
              </div>
            ) : (
              <>
                <ScaleOutPlanList
                  rows={planRows}
                  symbol={symbol}
                  completedLevels={completedScaleOutLevels}
                  onToggleLevel={toggleScaleOutLevel}
                  onLoadMore={
                    canLoadMorePlanRows
                      ? () => setPlanStepCount((count) => count + 6)
                      : undefined
                  }
                />
                <div className="mt-2.5 text-[11px] leading-relaxed text-slate-400">
                  Scale Out prices are calculated based on your average entry
                  price.
                </div>
              </>
            )}
          </Card>
        </div>

        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="text-base font-extrabold">
              {data.name || symbol} Transactions
            </div>
            <div className="flex items-center gap-3">
              <input
                type="text"
                placeholder="Search"
                className="w-[220px] max-w-full rounded-xl border border-gray-200 px-3 py-2 text-sm"
              />
              <button
                className="px-[14px] py-[9px] rounded-[10px] bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700"
                onClick={() => {
                  setSelectedTx(null);
                  setTransactionMode("add");
                  setTransactionModalOpen(true);
                }}
                type="button"
              >
                + Add Transaction
              </button>
            </div>
          </div>

          <Table>
            <thead className="border-b border-[#eef2f7]">
              <tr>
                <Th>Type</Th>
                <Th>Quantity</Th>
                <Th>Price</Th>
                <Th>Total</Th>
                <Th className="text-right">Gain / Loss</Th>
              </tr>
            </thead>

            <tbody>
              {data.transactions.map((tx) => {
                const dt = new Date(tx.executedAt);
                const isSell = tx.side === "sell";
                const feeUsd = Number(tx.feeUsd ?? 0);
                const hasFee = Number.isFinite(feeUsd) && feeUsd > 0;
                const pnl = tx.gainLossUsd;
                const pnlUp = (pnl ?? 0) >= 0;

                return (
                  <Tr
                    key={tx.id}
                    className="cursor-pointer hover:bg-slate-50"
                    onClick={() => handleEditTransaction(tx)}
                  >
                    <Td className="font-medium">
                      <div className="flex items-center gap-3 pl-1">
                        <CoinBadge
                          symbol={symbol}
                          iconUrl={data.iconUrl ?? null}
                          mode={badgeModeForTx(tx)}
                          size="md"
                          showBorder
                        />

                        <div className="grid">
                          <div className="text-[#0f172a]">
                            {isSell ? "Sell" : "Buy"} {symbol}
                          </div>
                          <div className="text-xs text-gray-500">
                            {dt.toLocaleString()}
                          </div>
                        </div>
                      </div>
                    </Td>

                    <Td className="text-[#0f172a]">
                      {isSell ? "-" : "+"}
                      {qty(Math.abs(tx.qty))} {symbol}
                    </Td>

                    <Td className="text-[#0f172a]">{usd(tx.priceUsd)}</Td>
                    <Td className="text-[#0f172a]">
                      <div className="grid">
                        <span>{usd(tx.totalUsd)}</span>
                        {hasFee ? (
                          <span className="text-xs font-medium text-red-600">
                            -{usd(feeUsd)} fee
                          </span>
                        ) : null}
                      </div>
                    </Td>

                    <Td className="text-right">
                      {isSell ? (
                        <div className="grid justify-end">
                          <span
                            className={cls(
                              "font-semibold",
                              pnlUp ? "text-emerald-600" : "text-red-600",
                            )}
                          >
                            {usd(tx.gainLossUsd)}
                          </span>
                          {tx.gainLossPct != null ? (
                            <span
                              className={cls(
                                "text-xs",
                                pnlUp ? "text-emerald-600" : "text-red-600",
                              )}
                            >
                              {pct(tx.gainLossPct)}
                            </span>
                          ) : null}
                        </div>
                      ) : (
                        <span className="text-gray-400">—</span>
                      )}
                    </Td>
                  </Tr>
                );
              })}
            </tbody>
          </Table>
        </Card>
      </div>

      <AddTransactionModal
        open={transactionModalOpen}
        onClose={closeTransactionModal}
        onDone={handleTransactionUpdated}
        mode={transactionMode}
        initialTx={selectedTx}
        initialAsset={
          transactionMode === "add"
            ? {
                id: symbol.toLowerCase(),
                symbol,
                name: data.name ?? symbol,
                thumb: data.iconUrl ?? null,
                priceUsd: data.metrics.currentPrice,
              }
            : null
        }
      />

      {strategyModalOpen && (
        <Modal
          open
          widthClass="max-w-5xl"
          title="Add Exit Strategy"
          onClose={() => (savingStrategy ? null : setStrategyModalOpen(false))}
          footer={
            <div className="flex items-center justify-end gap-3">
              <button
                className="rounded-xl border bg-white px-4 py-2 text-sm hover:bg-gray-50 disabled:opacity-50"
                onClick={() => setStrategyModalOpen(false)}
                type="button"
                disabled={savingStrategy}
              >
                Cancel
              </button>
              <button
                className="rounded-xl bg-purple-600 px-4 py-2 text-sm text-white hover:bg-purple-700 disabled:opacity-50"
                onClick={() => void saveStrategy()}
                type="button"
                disabled={savingStrategy}
              >
                {savingStrategy ? "Saving..." : "Save"}
              </button>
            </div>
          }
        >
          <div className="grid gap-4">
            {strategyError && (
              <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {strategyError}
              </div>
            )}

            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <div className="text-xs text-slate-500 font-semibold mb-2">
                Assets
              </div>
              <div className="inline-flex items-center rounded-full bg-purple-100 px-3 py-1.5 text-sm font-bold text-purple-700">
                {symbol} x
              </div>
            </div>

            <label className="grid gap-1">
              <span className="text-xs text-gray-500">Strategy Type</span>
              <select
                className="w-full rounded-xl border border-gray-200 px-3 py-2"
                value="percentage"
                disabled
              >
                <option value="percentage">Percentage Based</option>
              </select>
            </label>

            <div className="grid gap-3">
              <label className="grid gap-1">
                <span className="text-xs text-gray-500">Sell %</span>
                <input
                  type="number"
                  className="w-full rounded-xl border border-gray-200 px-3 py-2"
                  value={sellPercent}
                  onChange={(e) => {
                    setSellPercent(Number(e.target.value));
                    setModalPlanStepCount(6);
                  }}
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
                  onChange={(e) => {
                    setGainPercent(Number(e.target.value));
                    setModalPlanStepCount(6);
                  }}
                  min={0}
                  step={0.01}
                />
              </label>

              <label className="grid gap-1">
                <span className="text-xs text-gray-500">
                  Starting Quantity
                </span>
                <input
                  type="number"
                  className="w-full rounded-xl border border-gray-200 px-3 py-2"
                  value={startingQuantity}
                  onChange={(e) => {
                    setStartingQuantity(Number(e.target.value));
                    setModalPlanStepCount(6);
                  }}
                  min={0}
                  step={0.00000001}
                />
              </label>
            </div>

            <ScaleOutPlanList
              rows={modalPlanRows}
              symbol={symbol}
              onLoadMore={
                canLoadMoreModalPlanRows
                  ? () => setModalPlanStepCount((count) => count + 6)
                  : undefined
              }
            />
          </div>
        </Modal>
      )}
    </>
  );
}
