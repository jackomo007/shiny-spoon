"use client";

import { useState, useEffect } from "react";
import Card from "@/components/ui/Card";
import { Table, Th, Tr, Td } from "@/components/ui/Table";
import { usd, pct, qty, cls } from "@/components/portfolio/format";
import { CoinBadge } from "@/components/portfolio/CoinBadge";

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
    gainLossUsd: number | null;
    gainLossPct: number | null;
  }>;
};

type Props = {
  symbol: string;
  onBack: () => void;
};

export default function AssetDetailView({ symbol, onBack }: Props) {
  const [data, setData] = useState<AssetDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
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
    }
    void load();
  }, [symbol]);

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

  function badgeModeForTx(
    tx: AssetDetail["transactions"][0],
  ): "coin" | "win" | "loss" {
    if (tx.gainLossUsd == null) return "coin";
    return tx.gainLossUsd >= 0 ? "win" : "loss";
  }

  return (
    <div>
      {/* Back button */}
      <div className="flex items-center justify-between mb-6">
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-slate-700 hover:text-slate-900 font-semibold text-lg"
        >
          <span className="text-2xl text-slate-400">‹</span> Back
        </button>
      </div>

      {/* Balance & Key Levels cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Balance Card */}
        <Card className="p-6">
          <div className="flex items-center justify-between mb-2">
            <div className="text-sm text-slate-400 font-semibold">
              {symbol} Balance
            </div>
          </div>

          <div className="text-4xl font-bold mb-1">
            {usd(data.balance.valueUsd)}
          </div>
          <div className="text-slate-500 font-semibold mb-4">
            {data.balance.quantity.toFixed(4)} {symbol}
          </div>

          <div className="border-t border-slate-200 my-4" />

          <div className="grid grid-cols-2 gap-x-6 gap-y-4">
            <div>
              <div className="text-sm text-slate-400 mb-1">24h Change</div>
              <div
                className={cls(
                  "font-bold",
                  change24Up ? "text-emerald-600" : "text-red-600",
                )}
              >
                {usd(data.metrics.change24h.usd)}
              </div>
              <div
                className={cls(
                  "text-sm font-semibold",
                  change24Up ? "text-emerald-600" : "text-red-600",
                )}
              >
                {pct(data.metrics.change24h.pct ?? 0)}
              </div>
            </div>

            <div>
              <div className="text-sm text-slate-400 mb-1 flex items-center gap-1">
                Total Profit <span className="text-slate-300">ⓘ</span>
              </div>
              <div
                className={cls(
                  "font-bold",
                  totalProfitUp ? "text-emerald-600" : "text-red-600",
                )}
              >
                {usd(data.metrics.totalProfit.usd)}
              </div>
              <div
                className={cls(
                  "text-sm font-semibold",
                  totalProfitUp ? "text-emerald-600" : "text-red-600",
                )}
              >
                {pct(data.metrics.totalProfit.pct)}
              </div>
            </div>

            <div>
              <div className="text-sm text-slate-400 mb-1 flex items-center gap-1">
                Unrealised Profit <span className="text-slate-300">ⓘ</span>
              </div>
              <div
                className={cls(
                  "font-bold",
                  unrealizedUp ? "text-emerald-600" : "text-red-600",
                )}
              >
                {usd(data.metrics.unrealizedProfit)}
              </div>
            </div>

            <div>
              <div className="text-sm text-slate-400 mb-1 flex items-center gap-1">
                Realised Profit <span className="text-slate-300">ⓘ</span>
              </div>
              <div className="font-bold">
                {usd(data.metrics.realizedProfit)}
              </div>
            </div>

            <div>
              <div className="text-sm text-slate-400 mb-1">Avg. Buy Price</div>
              <div className="font-bold">{usd(data.metrics.avgBuyPrice)}</div>
            </div>

            <div>
              <div className="text-sm text-slate-400 mb-1">Total Invested</div>
              <div className="font-bold">{usd(data.metrics.totalInvested)}</div>
            </div>
          </div>
        </Card>

        {/* Key Levels Card */}
        <Card className="p-6">
          <div className="flex items-start justify-between mb-4">
            <div>
              <div className="font-bold text-lg mb-1">Key Levels</div>
              <div className="text-sm text-slate-500 font-semibold">
                Next support & resistance
              </div>
            </div>
            <span className="px-3 py-1 bg-slate-100 rounded-full text-xs font-semibold text-slate-600 border border-slate-200">
              {symbol}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Supports - apenas o primeiro */}
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 relative overflow-hidden">
              <div className="absolute left-0 top-0 bottom-0 w-1 bg-emerald-500 rounded-l-xl" />

              <div className="flex items-center justify-between mb-3">
                <div className="font-bold">Support</div>
                <div className="text-xs text-slate-500 font-semibold">
                  Below price
                </div>
              </div>

              <div className="bg-white border border-slate-200 rounded-xl p-3">
                <div className="text-xs text-slate-500 font-bold mb-1">
                  Next Support
                </div>
                <div className="text-2xl font-black mb-2">
                  {usd(data.keyLevels.supports[0]?.price ?? 0)}
                </div>
                <div className="flex flex-wrap gap-2">
                  <span className="px-2 py-1 bg-slate-100 rounded-full text-xs font-semibold border border-slate-200 whitespace-nowrap">
                    ~{data.keyLevels.supports[0]?.distance ?? "N/A"} away
                  </span>
                  <span className="px-2 py-1 bg-slate-100 rounded-full text-xs font-semibold border border-slate-200">
                    {data.keyLevels.supports[0]?.timeframe ?? "N/A"}
                  </span>
                </div>
              </div>
            </div>

            {/* Resistances - apenas a primeira */}
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 relative overflow-hidden">
              <div className="absolute left-0 top-0 bottom-0 w-1 bg-red-500 rounded-l-xl" />

              <div className="flex items-center justify-between mb-3">
                <div className="font-bold">Resistance</div>
                <div className="text-xs text-slate-500 font-semibold">
                  Above price
                </div>
              </div>

              <div className="bg-white border border-slate-200 rounded-xl p-3">
                <div className="text-xs text-slate-500 font-bold mb-1">
                  Next Resistance
                </div>
                <div className="text-2xl font-black mb-2">
                  {usd(data.keyLevels.resistances[0]?.price ?? 0)}
                </div>
                <div className="flex flex-wrap gap-2">
                  <span className="px-2 py-1 bg-slate-100 rounded-full text-xs font-semibold border border-slate-200 whitespace-nowrap">
                    ~{data.keyLevels.resistances[0]?.distance ?? "N/A"} away
                  </span>
                  <span className="px-2 py-1 bg-slate-100 rounded-full text-xs font-semibold border border-slate-200">
                    {data.keyLevels.resistances[0]?.timeframe ?? "N/A"}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </Card>
      </div>

      {/* Transactions table - AGORA USANDO O MESMO LAYOUT DO TransactionsTable */}
      <Card className="p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="text-lg font-bold">
            {data.name || symbol} Transactions
          </div>
          <div className="relative">
            <input
              type="text"
              placeholder="Search"
              className="w-[280px] max-w-full rounded-xl border border-gray-200 px-3 py-2 text-sm"
            />
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
              const pnl = tx.gainLossUsd;
              const pnlUp = (pnl ?? 0) >= 0;

              return (
                <Tr key={tx.id} className="cursor-pointer hover:bg-slate-50">
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
                  <Td className="text-[#0f172a]">{usd(tx.totalUsd)}</Td>

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
                        <span
                          className={cls(
                            "text-xs",
                            pnlUp ? "text-emerald-600" : "text-red-600",
                          )}
                        >
                          {pct(tx.gainLossPct)}
                        </span>
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
  );
}
