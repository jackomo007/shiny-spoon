"use client";

import { useMemo, useState, JSX } from "react";
import { usd, pct, cls } from "@/components/portfolio/format";

export type TxRow = {
  id: string;
  side: "buy" | "sell";
  symbol: string;
  name: string | null;
  iconUrl: string | null;
  executedAt: string;
  qty: number;
  priceUsd: number;
  totalUsd: number;
  gainLossUsd: number | null;
  gainLossPct: number | null;
};

export default function TransactionsTable(props: {
  rows: TxRow[];
  onRowClick?: (tx: TxRow) => void;
}) {
  const [q, setQ] = useState("");

  const rows = useMemo(() => {
    const query = q.trim().toLowerCase();
    if (!query) return props.rows;

    return props.rows.filter((r) => {
      const s = `${r.symbol} ${r.name ?? ""} ${r.side}`.toLowerCase();
      return s.includes(query);
    });
  }, [props.rows, q]);

  return (
    <div>
      {/* Search bar */}
      <div className="flex items-center justify-end mb-4">
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
            🔍
          </span>
          <input
            type="text"
            placeholder="Search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm w-64 outline-none focus:border-slate-300"
          />
        </div>
      </div>

      {/* Table */}
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
            {rows.reduce((acc, tx, index) => {
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
                  ? new Date(rows[index - 1].executedAt).toLocaleDateString(
                      "en-US",
                      {
                        day: "numeric",
                        month: "long",
                        year: "numeric",
                      },
                    )
                  : null;

              const showDateHeader = prevDate !== dateStr;

              const gainUp = (tx.gainLossUsd ?? 0) >= 0;
              const isSell = tx.side === "sell";

              const rowElements = [];

              // Adiciona header de data se necessário
              if (showDateHeader) {
                rowElements.push(
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
              rowElements.push(
                <tr
                  key={tx.id}
                  className="border-b border-slate-100 cursor-pointer hover:bg-slate-50"
                  onClick={() => props.onRowClick?.(tx)}
                >
                  <td className="py-4 px-2">
                    <div className="flex items-center gap-3">
                      {/* Ícone duplo */}
                      <div className="relative w-10 h-10">
                        <div
                          className={cls(
                            "absolute left-0 top-1 w-7 h-7 rounded-full flex items-center justify-center text-white font-black text-sm shadow-md",
                            isSell ? "bg-emerald-500" : "bg-orange-500",
                          )}
                        >
                          {tx.symbol.charAt(0)}
                        </div>
                        <div className="absolute right-0 bottom-1 w-5 h-5 rounded-full bg-emerald-500 flex items-center justify-center text-white font-black text-xs shadow-md">
                          $
                        </div>
                      </div>

                      {/* Texto */}
                      <div>
                        <div className="font-black">
                          {isSell ? "Sell" : "Buy"} {tx.symbol}
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
                        isSell ? "text-slate-700" : "text-emerald-600",
                      )}
                    >
                      {isSell ? "" : "+"}
                      {tx.qty.toFixed(2)} {tx.symbol}
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

              return [...acc, ...rowElements];
            }, [] as JSX.Element[])}
          </tbody>
        </table>
      </div>
    </div>
  );
}
