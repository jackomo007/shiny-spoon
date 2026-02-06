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
import TopPerformersCard from "@/components/portfolio/TopPerformersCard";
import AssetDetailView from "@/components/portfolio/AssetDetailView";
import Card from "@/components/ui/Card";
import { usd, pct, cls } from "@/components/portfolio/format";

type Summary = {
  currentBalanceUsd: number;
  totalInvestedUsd: number;
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
  const profitUp = s.profit.total.usd >= 0;
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
            Total Profit <span className="text-slate-300">ⓘ</span>
          </div>
          <div className="font-semibold flex items-center gap-2">
            <span
              className={cls(
                "inline-flex items-center gap-1 px-[10px] py-[6px] rounded-full text-[13px] font-semibold",
                profitUp
                  ? "bg-emerald-50 text-emerald-600"
                  : "bg-red-50 text-red-600",
              )}
            >
              {pct(s.profit.total.pct)}
            </span>
            <span className={profitUp ? "text-emerald-600" : "text-red-600"}>
              {usd(s.profit.total.usd)}
            </span>
          </div>
        </div>

        <div className="flex items-center justify-between py-3 border-t border-slate-200">
          <div className="text-slate-400 flex items-center gap-2">
            Realised Profit <span className="text-slate-300">ⓘ</span>
          </div>
          <div className="font-semibold">{usd(s.profit.realized.usd)}</div>
        </div>

        <div className="flex items-center justify-between py-3 border-t border-slate-200">
          <div className="text-slate-400 flex items-center gap-2">
            Unrealised Profit <span className="text-slate-300">ⓘ</span>
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
      </div>
    </Card>
  );
}

export default function PortfolioPage() {
  const [data, setData] = useState<PortfolioApiRes | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingTx, setEditingTx] = useState<TxRow | null>(null);
  const [activeTab, setActiveTab] = useState<"assets" | "transactions">(
    "assets",
  );

  const [selectedAsset, setSelectedAsset] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/portfolio", { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const j = (await res.json()) as PortfolioApiRes;
      setData(j);
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
      <div className="p-4 md:p-8">
        <div className="grid grid-cols-1 xl:grid-cols-[340px_1fr] gap-6">
          <div className="flex flex-col gap-6">
            {data && <BalanceCardFilled summary={data.summary} />}
            {data && <TopPerformersCard assets={data.assets} />}
          </div>

          <div>
            <AssetDetailView
              symbol={selectedAsset}
              onBack={() => setSelectedAsset(null)}
            />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-3">
        </div>

        <div className="flex items-center gap-4">
          <button
            className="px-[18px] py-[10px] rounded-[10px] bg-blue-600 text-white font-semibold hover:bg-blue-700"
            onClick={() => setModalOpen(true)}
          >
            + Add Asset
          </button>
        </div>
      </div>

      {loading ? (
        <Card className="p-6">Loading…</Card>
      ) : error ? (
        <Card className="p-6 text-red-600">{error}</Card>
      ) : !data ? (
        <Card className="p-6">No data.</Card>
      ) : !hasAssets ? (
        <div className="grid grid-cols-1 lg:grid-cols-[360px_1fr] gap-8">
          <div className="flex flex-col gap-6 lg:order-1 order-2">
            <BalanceCardEmpty summary={data.summary} />

            <div className="rounded-2xl shadow-[0_10px_30px_rgba(15,23,42,0.06)] h-[420px] border-2 border-dashed border-slate-200 bg-white/35 p-6 flex flex-col gap-3">
              <div className="font-bold text-slate-500">Top Performers</div>
              <div className="flex-1 flex items-center justify-center text-center text-sm text-slate-500 px-6">
                No assets yet. Top performers will appear here once you add
                assets.
              </div>
            </div>
          </div>

          <div className="lg:order-2 order-1 flex items-center justify-center">
            <Card className="rounded-2xl shadow-[0_10px_30px_rgba(15,23,42,0.06)] w-full min-h-[620px] flex items-center justify-center text-center">
              <div className="max-w-[420px] px-6">
                <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-[#f2eaff] text-[#5801cc] text-4xl font-bold">
                  💧
                </div>

                <div className="text-[22px] font-bold mb-2">
                  Your Portfolio is Empty
                </div>

                <div className="text-slate-500 leading-relaxed mb-6">
                  Add a new asset with the button below or use search to start
                  tracking your portfolio.
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
        <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
          <BalanceCardFilled summary={data.summary} />

          {/* NOVO: Holdings Allocation só aparece quando NÃO há asset selecionado */}
          <HoldingsAllocationCard assets={allocationAssets} />

          <TopPerformersCard assets={data.assets} />

          <div className="lg:col-start-2 lg:row-start-1 lg:row-span-3">
            <Card className="rounded-2xl shadow-[0_10px_30px_rgba(15,23,42,0.06)] p-0 overflow-hidden">
              <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
                <div className="flex items-center gap-2">
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
                    Transactions
                  </button>
                </div>
              </div>

              <div className="p-6">
                {activeTab === "assets" ? (
                  <AssetsTable
                    assets={data.assets}
                    onAssetClick={(symbol) => setSelectedAsset(symbol)}
                  />
                ) : (
                  <TransactionsTable
                    rows={data.transactions}
                    onRowClick={(tx) => {
                      setEditingTx(tx);
                      setModalOpen(true);
                    }}
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
