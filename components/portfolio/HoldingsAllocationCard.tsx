"use client";

import { useMemo } from "react";
import Card from "@/components/ui/Card";
import { PieChart, Pie, ResponsiveContainer, Cell, Tooltip } from "recharts";
import { buildChainAllocation } from "@/components/portfolio/chain-utils";

export type AllocationAssetRow = {
  symbol: string;
  chainId?: string | null;
  name: string | null;
  holdingsValueUsd: number;
  totalInvestedUsd: number;
};

type PieRow = {
  symbol: string;
  name: string;
  valueUsd: number;
  percent: number;
  color: string;
};

const ASSET_COLORS = [
  "#2B3FC8",
  "#3459BF",
  "#2F7FC0",
  "#2E66C4",
  "#C129AA",
  "#99C31C",
  "#CA6E17",
  "#1F94B8",
  "#7C3AED",
  "#10B981",
];

function usd(n: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(Number.isFinite(n) ? n : 0);
}

export default function HoldingsAllocationCard(props: {
  assets: AllocationAssetRow[];
}) {
  const { totalUsd, assetPie, chainPie } = useMemo(() => {
    const base = (props.assets ?? [])
      .map((a) => {
        const v =
          Number.isFinite(a.holdingsValueUsd) && a.holdingsValueUsd > 0
            ? a.holdingsValueUsd
            : a.totalInvestedUsd;
        return {
          symbol: a.symbol,
          name: a.name ?? a.symbol,
          valueUsd: Number.isFinite(v) && v > 0 ? v : 0,
        };
      })
      .filter((a) => a.valueUsd > 0)
      .sort((a, b) => b.valueUsd - a.valueUsd);

    const total = base.reduce((s, r) => s + r.valueUsd, 0);

    const assetRows: PieRow[] =
      total > 0
        ? base.map((r, index) => ({
            symbol: r.symbol,
            name: r.name,
            valueUsd: r.valueUsd,
            percent: (r.valueUsd / total) * 100,
            color: ASSET_COLORS[index % ASSET_COLORS.length],
          }))
        : [];

    const chainRows: PieRow[] = buildChainAllocation(
      props.assets.map((asset) => ({
        ...asset,
        coingeckoId: null,
        iconUrl: null,
        priceUsd: 0,
        change24hPct: null,
        avgPriceUsd: 0,
        qtyHeld: 0,
        currentProfitUsd: 0,
        currentProfitPct: null,
      })),
    ).map((row) => ({
      symbol: row.chain.symbol,
      name: row.chain.name,
      valueUsd: row.valueUsd,
      percent: row.percent,
      color: row.chain.color,
    }));

    return { totalUsd: total, assetPie: assetRows, chainPie: chainRows };
  }, [props.assets]);

  const hasData = assetPie.length > 0 && totalUsd > 0;

  return (
    <div className="grid min-w-0 items-stretch gap-6 xl:min-h-[312px] xl:grid-cols-2">
      <AllocationDonutCard
        title="Current Holdings"
        description="Your portfolio allocation broken down by each asset you currently hold."
        badge={`${assetPie.length} Assets`}
        centerValue={assetPie.length}
        centerLabel="assets held"
        emptyLabel="No holdings yet."
        pie={assetPie}
        hasData={hasData}
      />
      <AllocationDonutCard
        title="Chain Allocation"
        description="Your portfolio allocation grouped by the blockchain each asset belongs to."
        badge={`${chainPie.length} Chains`}
        centerValue={chainPie.length}
        centerLabel="chains held"
        emptyLabel="No chain allocation yet."
        pie={chainPie}
        hasData={chainPie.length > 0 && totalUsd > 0}
      />
    </div>
  );
}

function AllocationDonutCard({
  title,
  description,
  badge,
  centerValue,
  centerLabel,
  emptyLabel,
  pie,
  hasData,
}: {
  title: string;
  description: string;
  badge: string;
  centerValue: number;
  centerLabel: string;
  emptyLabel: string;
  pie: PieRow[];
  hasData: boolean;
}) {
  return (
    <Card className="flex h-full min-w-0 flex-col rounded-2xl border-[#E3E8F2] p-4 shadow-[0_10px_26px_rgba(15,23,42,0.05)]">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h2 className="text-[17px] font-extrabold leading-tight text-[#0F1B34]">
            {title}
          </h2>
          <p className="mt-1.5 max-w-[420px] text-[12px] font-medium leading-5 text-[#8A96AD]">
            {description}
          </p>
        </div>
        <div className="shrink-0 rounded-full border border-[#E4D8FF] bg-[#F7F2FF] px-3.5 py-1.5 text-xs font-extrabold text-[#7C3AED]">
          {badge}
        </div>
      </div>

      {!hasData ? (
        <div className="grid flex-1 place-items-center text-sm text-gray-600">
          {emptyLabel}
        </div>
      ) : (
        <div className="flex flex-1 flex-col justify-between gap-3 pt-2">
          <div className="relative mx-auto h-[165px] w-full max-w-[270px] [&_.recharts-sector:focus]:outline-none [&_.recharts-surface:focus]:outline-none [&_.recharts-wrapper:focus]:outline-none [&_svg:focus]:outline-none">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart
                className="outline-none [&_*:focus]:outline-none"
                style={{ outline: "none" }}
              >
                <Pie
                  data={pie}
                  dataKey="valueUsd"
                  nameKey="name"
                  innerRadius={44}
                  outerRadius={80}
                  stroke="#fff"
                  strokeWidth={1}
                  isAnimationActive={false}
                >
                  {pie.map((p) => (
                    <Cell key={`${title}-${p.symbol}`} fill={p.color} />
                  ))}
                </Pie>
                <Tooltip
                  cursor={false}
                  content={({ active, payload }) => {
                    if (!active || !payload?.length) return null;
                    const row = payload[0]?.payload as PieRow | undefined;
                    if (!row) return null;

                    return (
                      <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs shadow-[0_12px_30px_rgba(15,23,42,0.14)]">
                        <div className="flex items-center gap-2 font-extrabold text-[#0F1B34]">
                          <span
                            className="h-2.5 w-2.5 rounded-[4px]"
                            style={{ background: row.color }}
                          />
                          <span>{row.name}</span>
                        </div>
                        <div className="mt-1 grid gap-0.5 pl-4 font-semibold text-[#64748B]">
                          <span>{row.symbol}</span>
                          <span>
                            {row.percent.toFixed(1)}% · {usd(row.valueUsd)}
                          </span>
                        </div>
                      </div>
                    );
                  }}
                />
              </PieChart>
            </ResponsiveContainer>

            <div className="pointer-events-none absolute inset-0 grid place-items-center text-center">
              <div>
                <div className="text-[24px] font-extrabold leading-none text-[#0F1B34]">
                  {centerValue}
                </div>
                <div className="mt-1 text-[11px] font-semibold text-[#8A96AD]">
                  {centerLabel}
                </div>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1.5">
            {pie.map((p) => (
              <div
                key={`${title}-legend-${p.symbol}`}
                className="flex items-center gap-1.5 whitespace-nowrap text-[11px] font-extrabold text-[#516078]"
              >
                <span
                  className="h-2.5 w-2.5 rounded-[4px]"
                  style={{ background: p.color }}
                />
                <span>{p.symbol}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </Card>
  );
}
