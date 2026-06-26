"use client";

import Card from "@/components/ui/Card";
import { cls } from "@/components/portfolio/format";

type HealthAsset = {
  symbol: string;
  holdingsValueUsd: number;
  marketCapUsd?: number | null;
  isStablecoin?: boolean;
};

type AllocationKey = "btc" | "eth" | "large" | "mid" | "small" | "stable";

type AllocationRow = {
  key: AllocationKey;
  label: string;
  pct: number;
  points: number;
  fillClass: string;
  textClass: string;
};

const RISK_POINTS: Record<AllocationKey, number> = {
  stable: 0,
  btc: 10,
  eth: 25,
  large: 50,
  mid: 75,
  small: 100,
};
const STABLECOIN_SYMBOLS = new Set(["USDT", "USDC", "DAI", "TUSD", "USDP"]);

function clamp(n: number, min = 0, max = 100) {
  return Math.min(max, Math.max(min, n));
}

function pct(n: number) {
  return `${Math.round(clamp(n))}%`;
}

function categoryFor(asset: HealthAsset): AllocationKey {
  const symbol = asset.symbol.trim().toUpperCase();
  if (asset.isStablecoin || STABLECOIN_SYMBOLS.has(symbol)) return "stable";
  if (symbol === "BTC") return "btc";
  if (symbol === "ETH") return "eth";

  const marketCap = asset.marketCapUsd ?? 0;
  if (marketCap > 10_000_000_000) return "large";
  if (marketCap >= 1_000_000_000) return "mid";
  return "small";
}

function profileFor(score: number) {
  if (score < 15) return "Conservative";
  if (score < 35) return "Balanced";
  if (score < 60) return "Growth";
  if (score < 80) return "Aggressive";
  return "Extremely Aggressive";
}

export default function PortfolioHealthCard({ assets }: { assets: HealthAsset[] }) {
  const totalValue = assets.reduce(
    (sum, asset) =>
      sum +
      (Number.isFinite(asset.holdingsValueUsd) && asset.holdingsValueUsd > 0
        ? asset.holdingsValueUsd
        : 0),
    0,
  );

  const allocation = assets.reduce<Record<AllocationKey, number>>(
    (acc, asset) => {
      const value =
        Number.isFinite(asset.holdingsValueUsd) && asset.holdingsValueUsd > 0
          ? asset.holdingsValueUsd
          : 0;
      if (totalValue <= 0 || value <= 0) return acc;

      acc[categoryFor(asset)] += (value / totalValue) * 100;
      return acc;
    },
    { btc: 0, eth: 0, large: 0, mid: 0, small: 0, stable: 0 },
  );

  const rows: AllocationRow[] = [
    {
      key: "btc",
      label: "BTC",
      pct: allocation.btc,
      points: RISK_POINTS.btc,
      fillClass: "bg-[#F7931A]",
      textClass: "text-[#F7931A]",
    },
    {
      key: "eth",
      label: "ETH",
      pct: allocation.eth,
      points: RISK_POINTS.eth,
      fillClass: "bg-[#627EEA]",
      textClass: "text-[#627EEA]",
    },
    {
      key: "large",
      label: "Large Cap Alts",
      pct: allocation.large,
      points: RISK_POINTS.large,
      fillClass: "bg-[#7C3AED]",
      textClass: "text-[#7C3AED]",
    },
    {
      key: "mid",
      label: "Mid Cap Alts",
      pct: allocation.mid,
      points: RISK_POINTS.mid,
      fillClass: "bg-[#4F46E5]",
      textClass: "text-[#4F46E5]",
    },
    {
      key: "small",
      label: "Small Cap Alts",
      pct: allocation.small,
      points: RISK_POINTS.small,
      fillClass: "bg-[#D946EF]",
      textClass: "text-[#D946EF]",
    },
    {
      key: "stable",
      label: "Stablecoins",
      pct: allocation.stable,
      points: RISK_POINTS.stable,
      fillClass: "bg-[#22C55E]",
      textClass: "text-[#16A34A]",
    },
  ];

  const score = clamp(
    rows.reduce((sum, row) => sum + (row.pct / 100) * row.points, 0),
  );
  const profile = totalValue > 0 ? profileFor(score) : "No Assets";

  return (
    <Card className="rounded-[14px] p-5 shadow-[0_8px_20px_rgba(0,0,0,0.04)]">
      <div className="mb-5 text-lg font-semibold">Portfolio Health</div>

      <div className="mb-5 rounded-2xl border border-[#DFC9FF] bg-[#F7F1FF] p-4">
        <div className="mb-2 text-[11px] font-extrabold uppercase tracking-[0.08em] text-[#8D5BD8]">
          Risk Profile
        </div>
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
          <div className="text-[22px] font-black leading-tight text-slate-950">
            {profile}
          </div>
          <div className="mt-1 whitespace-nowrap text-sm font-black text-[#7C3AED]">
            {Math.round(score)}/100
          </div>
        </div>
        <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-[#EADCFF]">
          <div
            className="h-full rounded-full bg-[#7C3AED]"
            style={{ width: `${score}%` }}
          />
        </div>
      </div>

      <div className="rounded-2xl border border-[#EDF1F7] bg-[#FBFCFF] p-4">
        <div className="mb-3 text-[11px] font-black uppercase tracking-[0.08em] text-slate-500">
          Allocation
        </div>

        <div className="grid gap-0">
          {rows.map((row) => (
            <div
              key={row.key}
              className="grid grid-cols-[1fr_auto] items-center gap-x-3 gap-y-2 border-t border-[#EDF1F7] py-2.5 first:border-t-0 first:pt-0 last:pb-0"
            >
              <div className="text-sm font-extrabold text-slate-700">
                {row.label}
              </div>
              <div className={cls("text-sm font-black", row.textClass)}>
                {pct(row.pct)}
              </div>
              <div className="col-span-2 h-2 overflow-hidden rounded-full bg-[#E5E7EB]">
                <div
                  className={cls("h-full rounded-full", row.fillClass)}
                  style={{ width: `${clamp(row.pct)}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    </Card>
  );
}
