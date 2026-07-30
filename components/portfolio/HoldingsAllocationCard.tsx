"use client";

import { useMemo } from "react";
import Card from "@/components/ui/Card";
import { PieChart, Pie, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { usd } from "@/components/portfolio/format";
import { buildChainAllocation } from "@/components/portfolio/chain-utils";

export type AllocationAssetRow = {
  symbol: string;
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

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
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
    <div className="grid min-w-0 gap-6 xl:grid-cols-2">
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
    <Card className="min-w-0 rounded-2xl border-[#E3E8F2] p-6 shadow-[0_14px_34px_rgba(15,23,42,0.06)]">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h2 className="text-[21px] font-extrabold leading-tight text-[#0F1B34]">
            {title}
          </h2>
          <p className="mt-2 max-w-[420px] text-sm font-medium leading-6 text-[#7D8AA5]">
            {description}
          </p>
        </div>
        <div className="shrink-0 rounded-full border border-[#E4D8FF] bg-[#F7F2FF] px-4 py-2 text-sm font-extrabold text-[#7C3AED]">
          {badge}
        </div>
      </div>

      {!hasData ? (
        <div className="grid min-h-[300px] place-items-center text-sm text-gray-600">
          {emptyLabel}
        </div>
      ) : (
        <div className="flex min-h-[315px] flex-col justify-between gap-4 pt-5">
          <div className="relative mx-auto h-[230px] w-full max-w-[360px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={pie}
                  dataKey="valueUsd"
                  nameKey="name"
                  innerRadius={62}
                  outerRadius={112}
                  stroke="#fff"
                  strokeWidth={1}
                  isAnimationActive={false}
                >
                  {pie.map((p) => (
                    <Cell key={`${title}-${p.symbol}`} fill={p.color} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(_value, _name, item) => {
                    const row = item?.payload as PieRow | undefined;
                    const rowPct = row?.percent ?? 0;
                    const safePct = Number.isFinite(rowPct)
                      ? clamp(rowPct, 0, 100)
                      : 0;
                    const usdValue = row?.valueUsd ?? 0;
                    return [
                      `${safePct.toFixed(2)}% - ${usd(usdValue)}`,
                      row?.name ?? "Allocation",
                    ];
                  }}
                />
              </PieChart>
            </ResponsiveContainer>

            <div className="pointer-events-none absolute inset-0 grid place-items-center text-center">
              <div>
                <div className="text-[34px] font-extrabold leading-none text-[#0F1B34]">
                  {centerValue}
                </div>
                <div className="mt-2 text-sm font-semibold text-[#7D8AA5]">
                  {centerLabel}
                </div>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2">
            {pie.map((p) => (
              <div
                key={`${title}-legend-${p.symbol}`}
                className="flex items-center gap-2 whitespace-nowrap text-sm font-extrabold text-[#516078]"
              >
                <span
                  className="h-3 w-3 rounded-[4px]"
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
