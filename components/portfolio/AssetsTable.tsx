"use client";

import { useMemo, useState, type ReactNode } from "react";
import Card from "@/components/ui/Card";
import { Table, Th, Tr, Td } from "@/components/ui/Table";
import { usd, pct, qty, cls } from "@/components/portfolio/format";
import { CoinBadge } from "@/components/portfolio/CoinBadge";

export type AssetRow = {
  symbol: string;
  name: string | null;
  coingeckoId: string | null;
  iconUrl: string | null;
  priceUsd: number;
  change24hPct: number | null;
  totalInvestedUsd: number;
  avgPriceUsd: number;
  qtyHeld: number;
  holdingsValueUsd: number;
  currentProfitUsd: number;
  currentProfitPct: number | null;
  isStablecoin?: boolean;
  marketCapUsd?: number | null;
};

type SortKey =
  | "asset"
  | "price"
  | "totalInvested"
  | "avgPrice"
  | "currentProfit"
  | "roi"
  | "holdings";

type SortDirection = "asc" | "desc";

type SortConfig = {
  key: SortKey;
  direction: SortDirection;
};

function usd4(n: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 4,
    maximumFractionDigits: 4,
  }).format(Number.isFinite(n) ? n : 0);
}

function pct2Always(v: number | null, fallback = 0) {
  const n = v == null ? fallback : v;
  const safe = Number.isFinite(n) ? n : fallback;
  const sign = safe > 0 ? "" : safe < 0 ? "" : "";
  return `${sign}${safe.toFixed(2)}%`;
}

function sortValue(asset: AssetRow, key: SortKey) {
  switch (key) {
    case "asset":
      return asset.symbol;
    case "price":
      return asset.priceUsd;
    case "totalInvested":
      return asset.totalInvestedUsd;
    case "avgPrice":
      return asset.avgPriceUsd;
    case "currentProfit":
      return asset.currentProfitUsd;
    case "roi":
      return asset.currentProfitPct ?? Number.NEGATIVE_INFINITY;
    case "holdings":
      return asset.holdingsValueUsd;
  }
}

export default function AssetsTable(props: {
  assets: AssetRow[];
  title?: string;
  onAssetClick?: (symbol: string) => void;
}) {
  const [sort, setSort] = useState<SortConfig>({
    key: "currentProfit",
    direction: "desc",
  });

  const rows = useMemo(() => {
    return props.assets.slice().sort((a, b) => {
      const av = sortValue(a, sort.key);
      const bv = sortValue(b, sort.key);

      let result: number;
      if (typeof av === "string" || typeof bv === "string") {
        result = String(av).localeCompare(String(bv));
      } else {
        result = av - bv;
      }

      return sort.direction === "asc" ? result : -result;
    });
  }, [props.assets, sort]);

  function setSortKey(key: SortKey) {
    setSort((current) => ({
      key,
      direction:
        current.key === key && current.direction === "desc" ? "asc" : "desc",
    }));
  }

  function SortTh({ sortKey, children }: { sortKey: SortKey; children: ReactNode }) {
    const active = sort.key === sortKey;
    const arrow = active ? (sort.direction === "asc" ? "↑" : "↓") : "↕";

    return (
      <Th className="pr-4">
        <button
          type="button"
          className={cls(
            "inline-flex items-center gap-1.5 whitespace-nowrap text-sm font-extrabold",
            active ? "text-[#5801cc]" : "text-[#69758a] hover:text-slate-700",
          )}
          onClick={() => setSortKey(sortKey)}
        >
          <span className="text-xs">{arrow}</span>
          <span>{children}</span>
        </button>
      </Th>
    );
  }

  return (
    <Card className="min-w-0 p-0 rounded-2xl overflow-hidden">
      {props.title ? (
        <div className="pt-1 pb-3 flex items-center justify-between gap-3">
          <div className="font-semibold text-[#0f172a]">{props.title}</div>
        </div>
      ) : null}

      <Table className="min-w-[880px]">
        <thead className="border-b border-[#eef2f7]">
          <tr>
            <SortTh sortKey="asset">Asset</SortTh>
            <SortTh sortKey="price">Price / 24h</SortTh>
            <SortTh sortKey="totalInvested">Total Invested</SortTh>
            <SortTh sortKey="avgPrice">Avg. Price</SortTh>
            <SortTh sortKey="currentProfit">Current Profit</SortTh>
            <SortTh sortKey="roi">ROI</SortTh>
            <SortTh sortKey="holdings">Holdings</SortTh>
          </tr>
        </thead>

        <tbody>
          {rows.map((a) => {
            const change24 = a.change24hPct ?? 0;
            const up24 = change24 >= 0;

            const upPnl = (a.currentProfitUsd ?? 0) >= 0;

            return (
              <Tr
                key={a.symbol}
                onClick={() => props.onAssetClick?.(a.symbol)} // NOVO: clique na linha
                className={cls(
                  props.onAssetClick && "cursor-pointer hover:bg-slate-50", // NOVO: visual de clicável
                )}
              >
                <Td className="font-medium">
                  <div className="flex items-center gap-3">
                    <CoinBadge
                      symbol={a.symbol}
                      iconUrl={a.iconUrl ?? null}
                      mode="coin"
                    />

                    <div className="grid">
                      <span className="text-[#0f172a]">{a.symbol}</span>
                      <span className="text-xs text-gray-500">
                        {a.name ?? ""}
                      </span>
                    </div>
                  </div>
                </Td>

                <Td>
                  <div className="grid">
                    <span className="font-medium">{usd4(a.priceUsd)}</span>

                    <span
                      className={cls(
                        "text-xs",
                        up24 ? "text-emerald-600" : "text-red-600",
                      )}
                    >
                      {pct2Always(a.change24hPct, 0)}
                    </span>
                  </div>
                </Td>

                <Td>{usd(a.totalInvestedUsd)}</Td>

                <Td>{usd4(a.avgPriceUsd)}</Td>

                <Td>
                  <div className="grid">
                    <span
                      className={cls(
                        "font-medium",
                        upPnl ? "text-emerald-600" : "text-red-600",
                      )}
                    >
                      {usd(a.currentProfitUsd)}
                    </span>
                  </div>
                </Td>

                <Td>
                  <span
                    className={cls(
                      "font-semibold",
                      upPnl ? "text-emerald-600" : "text-red-600",
                    )}
                  >
                    {pct(a.currentProfitPct)}
                  </span>
                </Td>

                <Td>
                  <div className="grid">
                    <span className="font-medium">
                      {usd(a.holdingsValueUsd)}
                    </span>
                    <span className="text-xs text-gray-500">
                      {qty(a.qtyHeld)} {a.symbol}
                    </span>
                  </div>
                </Td>
              </Tr>
            );
          })}
        </tbody>
      </Table>
    </Card>
  );
}
