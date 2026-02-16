"use client";

import { useState, useEffect, JSX } from "react";
import Card from "@/components/ui/Card";
import { usd, pct, cls } from "@/components/portfolio/format";

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

      {/* Transactions table */}
      <Card className="p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="text-lg font-bold">
            {data.name || symbol} Transactions
          </div>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
              🔍
            </span>
            <input
              type="text"
              placeholder="Search"
              className="pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm w-64 outline-none focus:border-slate-300"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-t border-b border-slate-200 text-xs text-slate-500 font-bold">
                <th className="text-left py-3 px-2">Type</th>
                <th className="text-left py-3 px-2">Quantity</th>
                <th className="text-left py-3 px-2">Price</th>
                <th className="text-left py-3 px-2">Total</th>
                <th className="text-right py-3 px-2">Gain/Loss</th>
              </tr>
            </thead>
            <tbody>
              {data.transactions.reduce((acc, tx, index) => {
                const date = new Date(tx.executedAt);
                const dateStr = date.toLocaleDateString("en-US", {
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                });
                const timeStr = date.toLocaleTimeString("en-US", {
                  hour: "2-digit",
                  minute: "2-digit",
                });

                // Verifica se precisa adicionar header de data
                const prevDate =
                  index > 0
                    ? new Date(
                        data.transactions[index - 1].executedAt,
                      ).toLocaleDateString("en-US", {
                        day: "numeric",
                        month: "long",
                        year: "numeric",
                      })
                    : null;

                const showDateHeader = prevDate !== dateStr;

                const gainUp = (tx.gainLossUsd ?? 0) >= 0;

                const rows = [];

                // Adiciona header de data se necessário
                if (showDateHeader) {
                  rows.push(
                    <tr key={`date-${tx.id}`}>
                      <td
                        colSpan={5}
                        className="py-3 px-2 font-bold text-sm text-slate-700"
                      >
                        {dateStr}
                      </td>
                    </tr>,
                  );
                }

                // Adiciona linha da transação
                rows.push(
                  <tr key={tx.id} className="border-b border-slate-100">
                    <td className="py-4 px-2">
                      <div className="flex items-center gap-3">
                        <div className="relative w-10 h-10">
                          <div
                            className={cls(
                              "absolute left-0 top-1 w-7 h-7 rounded-full flex items-center justify-center text-white font-black text-sm shadow-md",
                              tx.side === "buy"
                                ? "bg-orange-500"
                                : "bg-emerald-500",
                            )}
                          >
                            {symbol.charAt(0)}
                          </div>
                          <div className="absolute right-0 bottom-1 w-5 h-5 rounded-full bg-emerald-500 flex items-center justify-center text-white font-black text-xs shadow-md">
                            $
                          </div>
                        </div>
                        <div>
                          <div className="font-black">
                            {tx.side === "buy" ? "Buy" : "Sell"} {symbol}
                          </div>
                          <div className="text-xs text-slate-500 font-bold">
                            {timeStr}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="py-4 px-2">
                      <span
                        className={cls(
                          "font-bold",
                          tx.side === "buy"
                            ? "text-emerald-600"
                            : "text-slate-700",
                        )}
                      >
                        {tx.side === "buy" ? "+" : ""}
                        {tx.qty.toFixed(2)} {symbol}
                      </span>
                    </td>
                    <td className="py-4 px-2 font-semibold">
                      {usd(tx.priceUsd)}
                    </td>
                    <td className="py-4 px-2 font-semibold">
                      {usd(tx.totalUsd)}
                    </td>
                    <td className="py-4 px-2 text-right">
                      {tx.gainLossUsd !== null ? (
                        <>
                          <div
                            className={cls(
                              "font-bold",
                              gainUp ? "text-emerald-600" : "text-red-600",
                            )}
                          >
                            {usd(tx.gainLossUsd)}
                          </div>
                          {tx.gainLossPct !== null && (
                            <div
                              className={cls(
                                "text-sm font-semibold",
                                gainUp ? "text-emerald-600" : "text-red-600",
                              )}
                            >
                              {pct(tx.gainLossPct)}
                            </div>
                          )}
                        </>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>
                  </tr>,
                );

                return [...acc, ...rows];
              }, [] as JSX.Element[])}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
