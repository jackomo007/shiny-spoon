"use client";

import { useMemo, useState } from "react";
import Card from "@/components/ui/Card";
import { Table, Th, Tr, Td } from "@/components/ui/Table";
import { usd, pct, qty, cls } from "@/components/portfolio/format";
import { CoinBadge } from "@/components/portfolio/CoinBadge";

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
  feeUsd?: number | null;
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

  function badgeModeForTx(t: TxRow): "coin" | "win" | "loss" {
    if (t.gainLossUsd == null) return "coin";
    return t.gainLossUsd >= 0 ? "win" : "loss";
  }

  return (
    <Card className="min-w-0 p-0 rounded-2xl overflow-hidden">
      <div className="pt-1 pb-3 flex items-center justify-between gap-3">
        <input
          className="w-[280px] max-w-full rounded-xl border border-gray-200 px-3 py-2 text-sm"
          placeholder="Search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </div>
      <Table className="min-w-[720px]">
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
          {rows.map((t) => {
            const dt = new Date(t.executedAt);
            const isSell = t.side === "sell";
            const pnl = t.gainLossUsd;
            const pnlUp = (pnl ?? 0) >= 0;

            return (
              <Tr
                key={t.id}
                onClick={() => props.onRowClick?.(t)}
                className="cursor-pointer hover:bg-slate-50"
              >
                <Td className="font-medium">
                  <div className="flex items-center gap-3 pl-1">
                    <CoinBadge
                      symbol={t.symbol}
                      iconUrl={t.iconUrl ?? null}
                      mode={badgeModeForTx(t)}
                      size="md"
                      showBorder
                    />

                    <div className="grid">
                      <div className="text-[#0f172a]">
                        {isSell ? "Sell" : "Buy"} {t.symbol}
                      </div>
                      <div className="text-xs text-gray-500">
                        {dt.toLocaleString()}
                      </div>
                    </div>
                  </div>
                </Td>

                <Td className="text-[#0f172a]">
                  {isSell ? "-" : "+"}
                  {qty(Math.abs(t.qty))} {t.symbol}
                </Td>

                <Td className="text-[#0f172a]">{usd(t.priceUsd)}</Td>
                <Td className="text-[#0f172a]">
                  <div className="grid">
                    <span>{usd(t.totalUsd)}</span>
                    {t.feeUsd && t.feeUsd > 0 ? (
                      <span className="text-xs font-medium text-red-600">
                        -{usd(t.feeUsd)} fee
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
                        {usd(t.gainLossUsd)}
                      </span>
                      {t.gainLossPct != null ? (
                        <span
                          className={cls(
                            "text-xs",
                            pnlUp ? "text-emerald-600" : "text-red-600",
                          )}
                        >
                          {pct(t.gainLossPct)}
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
  );
}
