"use client";

import { useEffect, useMemo, useState } from "react";
import AddTransactionModal from "@/components/portfolio/AddTransactionModal";
import AssetsTable, { AssetRow } from "@/components/portfolio/AssetsTable";
import TransactionsTable, {
  TxRow,
} from "@/components/portfolio/TransactionsTable";
import HoldingsAllocationCard, {
  AllocationAssetRow,
} from "@/components/portfolio/HoldingsAllocationCard";
import PortfolioHealthCard from "@/components/portfolio/PortfolioHealthCard";
import AssetDetailView from "@/components/portfolio/AssetDetailView";
import Card from "@/components/ui/Card";
import { usd, pct, cls } from "@/components/portfolio/format";

type Summary = {
  currentBalanceUsd: number;
  totalInvestedUsd: number;
  stablecoinValueUsd: number;
  profit: {
    realized: { usd: number };
    unrealized: { usd: number };
    total: { usd: number; pct: number };
  };
  portfolio24h: { pct: number; usd: number };
  topPerformer: null | {
    symbol: string;
    name: string | null;
    profitUsd: number;
    profitPct: number | null;
  };
};

type PortfolioApiRes = {
  summary: Summary;
  assets: AssetRow[];
  transactions: TxRow[];
};

type ExitStrategySummary = {
  id: string;
  isAllCoins: boolean;
  coinSymbols: string[];
  sellPercent: number;
  gainPercent: number;
  isActive: boolean;
  totalAssets: number;
  totalProfitUsd: number;
  realizedGainUsd?: number;
};

type ExitStrategiesApiRes = {
  data: ExitStrategySummary[];
};

type PortfolioTab = "assets" | "transactions" | "exitStrategies";

function BalanceCardEmpty({ summary: s }: { summary: Summary }) {
  const change24Up = s.portfolio24h.pct >= 0;

  return (
    <Card className="rounded-2xl shadow-[0_10px_30px_rgba(15,23,42,0.06)] p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="text-sm text-slate-500 font-medium">
          Current Balance
        </div>
        <div className="text-sm text-slate-500 font-medium">24h</div>
      </div>

      <div className="text-4xl font-bold my-2">{usd(s.currentBalanceUsd)}</div>

      <div className="flex gap-3 text-sm text-slate-500">
        <span className={change24Up ? "text-emerald-600" : "text-red-600"}>
          {pct(s.portfolio24h.pct)}
        </span>
        <span className={change24Up ? "text-emerald-600" : "text-red-600"}>
          {usd(s.portfolio24h.usd)}
        </span>
      </div>
    </Card>
  );
}

function BalanceCardFilled({ summary: s }: { summary: Summary }) {
  const unrealizedUp = s.profit.unrealized.usd >= 0;

  return (
    <Card className="rounded-[14px] shadow-[0_8px_20px_rgba(0,0,0,0.04)] flex flex-col p-6">
      <div className="flex items-center justify-between mb-2">
        <div className="text-[15px] font-medium text-slate-400 flex items-center gap-2">
          Current Balance
        </div>
        <div className="text-[15px] font-medium text-slate-500 flex items-center gap-1">
          24h <span className="text-xs">▾</span>
        </div>
      </div>

      <div className="text-[36px] font-bold tracking-[-0.5px] mb-1">
        {usd(s.currentBalanceUsd)}
      </div>

      <div className="text-[15px]">
        <div className="flex items-center gap-3 mb-3">
          <span
            className={cls(
              "font-semibold text-sm",
              s.portfolio24h.pct >= 0 ? "text-emerald-600" : "text-red-600",
            )}
          >
            {pct(s.portfolio24h.pct)}
          </span>
          <span
            className={cls(
              "font-semibold text-sm",
              s.portfolio24h.pct >= 0 ? "text-emerald-600" : "text-red-600",
            )}
          >
            {usd(s.portfolio24h.usd)}
          </span>
        </div>

        <div className="flex items-center justify-between py-3 border-t border-slate-200">
          <div className="text-slate-400 flex items-center gap-2">
            Realized Gain <span className="text-slate-300">ⓘ</span>
          </div>
          <div className="font-semibold text-emerald-600">
            {usd(s.profit.realized.usd)}
          </div>
        </div>

        <div className="flex items-center justify-between py-3 border-t border-slate-200">
          <div className="text-slate-400 flex items-center gap-2">
            Unrealized Gain <span className="text-slate-300">ⓘ</span>
          </div>

          <div
            className={cls(
              "font-semibold",
              unrealizedUp ? "text-emerald-600" : "text-red-600",
            )}
          >
            {usd(s.profit.unrealized.usd)}
          </div>
        </div>

        <div className="flex items-center justify-between py-3 border-t border-slate-200">
          <div className="text-slate-400">Total Invested</div>
          <div className="font-semibold">{usd(s.totalInvestedUsd)}</div>
        </div>

        <div className="flex items-center justify-between py-3 border-t border-slate-200">
          <div className="text-slate-400">Stablecoins</div>
          <div className="font-semibold">{usd(s.stablecoinValueUsd)}</div>
        </div>
      </div>
    </Card>
  );
}

function PortfolioLoadingState() {
  return (
    <div
      className="grid min-h-[520px] place-items-center rounded-[20px] bg-gray-50/70 px-4"
      aria-busy="true"
      aria-live="polite"
    >
      <div className="flex min-w-[240px] flex-col items-center gap-4 rounded-[18px] border border-[#E9E6F2] bg-white/95 px-6 py-5 text-center shadow-[0_18px_48px_rgba(20,18,26,0.10)]">
        <div className="relative h-12 w-12" aria-hidden="true">
          <div className="absolute inset-0 rounded-full border-4 border-[#F1EAFE]" />
          <div className="absolute inset-0 animate-spin rounded-full border-4 border-transparent border-t-[#7C3AED]" />
          <div className="absolute inset-[14px] rounded-full bg-[radial-gradient(circle_at_30%_30%,#B49BFF,#7C3AED)]" />
        </div>
        <div className="grid gap-1">
          <div className="text-sm font-extrabold text-[#14121A]">
            Loading portfolio
          </div>
          <div className="text-xs font-semibold text-[#6B6777]">
            Syncing your assets and transactions...
          </div>
        </div>
      </div>
    </div>
  );
}

export default function PortfolioPage() {
  const [data, setData] = useState<PortfolioApiRes | null>(null);
  const [exitStrategies, setExitStrategies] = useState<ExitStrategySummary[]>(
    [],
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [exitStrategiesError, setExitStrategiesError] = useState<string | null>(
    null,
  );
  const [modalOpen, setModalOpen] = useState(false);
  const [editingTx, setEditingTx] = useState<TxRow | null>(null);
  const [activeTab, setActiveTab] = useState<PortfolioTab>("assets");

  const [selectedAsset, setSelectedAsset] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    setExitStrategiesError(null);
    try {
      const portfolioRes = await fetch("/api/portfolio", { cache: "no-store" });
      if (!portfolioRes.ok) throw new Error(`HTTP ${portfolioRes.status}`);
      const portfolioJson = (await portfolioRes.json()) as PortfolioApiRes;
      setData(portfolioJson);

      try {
        const strategiesRes = await fetch("/api/exit-strategies", {
          cache: "no-store",
        });
        if (!strategiesRes.ok) {
          throw new Error(`HTTP ${strategiesRes.status}`);
        }

        const strategiesJson =
          (await strategiesRes.json()) as ExitStrategiesApiRes;
        setExitStrategies(strategiesJson.data ?? []);
      } catch (strategyError) {
        setExitStrategies([]);
        setExitStrategiesError(
          strategyError instanceof Error
            ? strategyError.message
            : "Failed to load exit strategies",
        );
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  const hasAssets = (data?.assets?.length ?? 0) > 0;

  const allocationAssets: AllocationAssetRow[] = useMemo(() => {
    return (data?.assets ?? []).map((a) => ({
      symbol: a.symbol,
      name: a.name ?? null,
      holdingsValueUsd: a.holdingsValueUsd,
      totalInvestedUsd: a.totalInvestedUsd,
    }));
  }, [data?.assets]);

  if (selectedAsset) {
    return (
      <div className="min-w-0 overflow-x-hidden">
        <div className="grid min-w-0 grid-cols-1 gap-6 xl:grid-cols-[340px_minmax(0,1fr)]">
          <div className="min-w-0 flex flex-col gap-6">
            {data && <BalanceCardFilled summary={data.summary} />}
            {data && <PortfolioHealthCard assets={data.assets} />}
          </div>

          <div className="min-w-0">
            <AssetDetailView
              symbol={selectedAsset}
              onBack={() => setSelectedAsset(null)}
              onPortfolioChange={load}
            />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-w-0 overflow-x-hidden">
      {loading ? (
        <PortfolioLoadingState />
      ) : error ? (
        <Card className="p-6 text-red-600">{error}</Card>
      ) : !data ? (
        <Card className="p-6">No data.</Card>
      ) : !hasAssets ? (
        <div className="grid min-w-0 grid-cols-1 gap-8 lg:grid-cols-[360px_minmax(0,1fr)]">
          <div className="min-w-0 flex flex-col gap-6 lg:order-1 order-2">
            <BalanceCardEmpty summary={data.summary} />

            <div className="rounded-2xl shadow-[0_10px_30px_rgba(15,23,42,0.06)] h-[420px] border-2 border-dashed border-slate-200 bg-white/35 p-6 flex flex-col gap-3">
              <div className="font-bold text-slate-500">Portfolio Health</div>
              <div className="flex-1 flex items-center justify-center text-center text-sm text-slate-500 px-6">
                No assets yet. Your risk profile will appear here once you add assets.
              </div>
            </div>
          </div>

          <div className="min-w-0 lg:order-2 order-1 flex items-center justify-center">
            <Card className="rounded-2xl shadow-[0_10px_30px_rgba(15,23,42,0.06)] w-full min-h-[620px] flex items-center justify-center text-center">
              <div className="max-w-[420px] px-6">
                <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-[#f2eaff] text-[#5801cc] text-4xl font-bold">
                  💧
                </div>

                <div className="text-[22px] font-bold mb-2">Your Portfolio is Empty</div>

                <div className="text-slate-500 leading-relaxed mb-6">
                  Add a new asset with the button below or use search to start tracking your portfolio.
                </div>

                <button
                  className="px-[18px] py-[10px] rounded-[10px] bg-blue-600 text-white font-semibold hover:bg-blue-700 mt-2"
                  onClick={() => setModalOpen(true)}
                >
                  + Add Asset
                </button>
              </div>
            </Card>
          </div>
        </div>
      ) : (
        <div className="grid min-w-0 gap-6 lg:grid-cols-[320px_minmax(0,1fr)]">
          <div className="min-w-0 flex flex-col gap-6">
            <BalanceCardFilled summary={data.summary} />
            <PortfolioHealthCard assets={data.assets} />
          </div>

          <div className="min-w-0 flex flex-col gap-6">
            <HoldingsAllocationCard assets={allocationAssets} />

            <Card className="min-w-0 rounded-2xl shadow-[0_10px_30px_rgba(15,23,42,0.06)] p-0 overflow-hidden">
              <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-4 border-b border-slate-200 sm:px-6">
                <div className="flex min-w-0 flex-wrap items-center gap-2">
                  <button
                    onClick={() => setActiveTab("assets")}
                    className={cls(
                      "px-4 py-2 rounded-full text-sm font-semibold",
                      activeTab === "assets"
                        ? "bg-[#f2eaff] text-[#5801cc] border border-[rgba(88,1,204,0.25)]"
                        : "bg-slate-100 text-slate-600",
                    )}
                  >
                    Your Assets
                  </button>

                  <button
                    onClick={() => setActiveTab("transactions")}
                    className={cls(
                      "px-4 py-2 rounded-full text-sm font-semibold",
                      activeTab === "transactions"
                        ? "bg-[#f2eaff] text-[#5801cc] border border-[rgba(88,1,204,0.25)]"
                      : "bg-slate-100 text-slate-600",
                    )}
                  >
                    Recent Transactions
                  </button>

                  <button
                    onClick={() => setActiveTab("exitStrategies")}
                    className={cls(
                      "px-4 py-2 rounded-full text-sm font-semibold",
                      activeTab === "exitStrategies"
                        ? "bg-[#f2eaff] text-[#5801cc] border border-[rgba(88,1,204,0.25)]"
                        : "bg-slate-100 text-slate-600",
                    )}
                  >
                    Exit Strategies
                  </button>
                </div>

                {activeTab === "assets" && (
                  <button
                    className="px-[18px] py-[10px] rounded-[10px] bg-blue-600 text-white font-semibold hover:bg-blue-700"
                    onClick={() => setModalOpen(true)}
                  >
                    + Add Asset
                  </button>
                )}
              </div>

              <div className="min-w-0 p-4 sm:p-6">
                {activeTab === "assets" ? (
                  <AssetsTable
                    assets={data.assets}
                    onAssetClick={(symbol) => setSelectedAsset(symbol)}
                  />
                ) : activeTab === "transactions" ? (
                  <TransactionsTable
                    rows={data.transactions.slice(0, 10)}
                    onRowClick={(tx) => {
                      setEditingTx(tx);
                      setModalOpen(true);
                    }}
                  />
                ) : (
                  <ExitStrategiesList
                    items={exitStrategies}
                    error={exitStrategiesError}
                  />
                )}
              </div>
            </Card>
          </div>
        </div>
      )}

      <AddTransactionModal
        open={modalOpen}
        mode={editingTx ? "edit" : "add"}
        initialTx={editingTx}
        onClose={() => {
          setModalOpen(false);
          setEditingTx(null);
        }}
        onDone={async () => {
          setModalOpen(false);
          setEditingTx(null);
          await load();
        }}
      />

      <footer className="text-xs text-gray-500 py-6 flex items-center gap-6 mt-8">
        <span>© 2025 Stakk AI. All rights reserved.</span>
      </footer>
    </div>
  );
}

function ExitStrategiesList({
  items,
  error,
}: {
  items: ExitStrategySummary[];
  error: string | null;
}) {
  if (error) {
    return (
      <div className="rounded-xl border border-red-100 bg-red-50 p-6 text-center text-sm text-red-600">
        Failed to load exit strategies: {error}
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-6 text-center text-sm text-slate-500">
        No exit strategies yet. Open an asset and use Change Plan to create one.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="border-b border-[#eef2f7]">
          <tr className="text-left text-slate-500">
            <th className="px-3 py-3 font-semibold">Assets</th>
            <th className="px-3 py-3 font-semibold">Plan</th>
            <th className="px-3 py-3 font-semibold">Status</th>
            <th className="px-3 py-3 text-right font-semibold">
              Realized Gain
            </th>
          </tr>
        </thead>
        <tbody>
          {items.map((strategy) => {
            const assetLabel = strategy.isAllCoins
              ? `All Assets (${strategy.totalAssets})`
              : strategy.coinSymbols.join(", ");

            return (
              <tr
                key={strategy.id}
                className="border-b border-[#eef2f7] last:border-b-0"
              >
                <td className="px-3 py-4 font-semibold text-slate-900">
                  {assetLabel || "No assets"}
                </td>
                <td className="px-3 py-4 text-slate-700">
                  Sell {strategy.sellPercent.toLocaleString()}% every{" "}
                  {strategy.gainPercent.toLocaleString()}% gain
                </td>
                <td className="px-3 py-4">
                  <span
                    className={cls(
                      "inline-flex rounded-full px-2.5 py-1 text-xs font-semibold",
                      strategy.isActive
                        ? "bg-emerald-50 text-emerald-600"
                        : "bg-slate-100 text-slate-500",
                    )}
                  >
                    {strategy.isActive ? "Active" : "Inactive"}
                  </span>
                </td>
                <td className="px-3 py-4 text-right font-semibold text-slate-900">
                  {usd(strategy.realizedGainUsd ?? 0)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
