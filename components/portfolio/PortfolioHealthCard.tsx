"use client";

import Card from "@/components/ui/Card";
import { cls } from "@/components/portfolio/format";
import {
  classifyPortfolioAsset,
  type PortfolioAllocationCategory,
} from "@/lib/portfolio-classification";

type HealthAsset = {
  symbol: string;
  holdingsValueUsd: number;
  marketCapUsd?: number | null;
  isStablecoin?: boolean;
};

type AllocationKey = PortfolioAllocationCategory;

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
function clamp(n: number, min = 0, max = 100) {
  return Math.min(max, Math.max(min, n));
}

function pct(n: number) {
  return `${Math.round(clamp(n))}%`;
}

function profileFor(score: number) {
  if (score < 15) return "Conservative";
  if (score < 35) return "Balanced";
  if (score < 60) return "Growth";
  if (score < 80) return "Aggressive";
  return "Extremely Aggressive";
}

function stepFor(score: number) {
  if (score < 15) return 1;
  if (score < 35) return 2;
  if (score < 60) return 3;
  if (score < 80) return 4;
  return 5;
}

const RISK_STEPS = [
  { step: 1, label: "Conservative" },
  { step: 2, label: "Balanced" },
  { step: 3, label: "Growth" },
  { step: 4, label: "Aggressive" },
  { step: 5, label: "Extremely Aggressive" },
] as const;

const RISK_DESCRIPTIONS: Record<string, string> = {
  Conservative:
    "Your portfolio is positioned defensively, prioritizing stability and capital preservation over high-growth upside.",
  Balanced:
    "Your portfolio has a balanced mix of protection and growth exposure, giving you upside potential while keeping risk controlled.",
  Growth:
    "Your portfolio is tilted toward higher-volatility positions, giving you more upside potential while still keeping more stable holdings.",
  Aggressive:
    "Your portfolio is concentrated in higher-volatility positions, creating greater upside potential but also larger exposure to sharp market swings.",
  "Extremely Aggressive":
    "Your portfolio is highly speculative, with heavy exposure to volatile assets that can produce large gains or sharp drawdowns.",
};

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

      acc[classifyPortfolioAsset(asset)] += (value / totalValue) * 100;
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
  const hasAssets = totalValue > 0;
  const profile = hasAssets ? profileFor(score) : "No Assets";
  const activeStep = hasAssets ? stepFor(score) : 0;
  const description = hasAssets ? RISK_DESCRIPTIONS[profile] : null;

  return (
    <Card className="rounded-[14px] p-5 shadow-[0_8px_20px_rgba(0,0,0,0.04)]">
      <div className="mb-5 text-lg font-semibold">Portfolio Health</div>

      <div className="mb-5 rounded-2xl border border-[#DFC9FF] bg-[#F7F1FF] p-4">
        <div className="mb-2 flex items-center justify-between">
          <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#8D5BD8]">
            Risk Profile
          </div>
          <div
            title="Your risk profile is derived from how your holdings are allocated across asset categories."
            className="flex h-5 w-5 items-center justify-center rounded-full bg-white text-[11px] font-bold text-[#8D5BD8]"
          >
            ?
          </div>
        </div>

        <div className="text-[22px] font-black leading-tight text-slate-950">
          {profile}
        </div>

        {description && (
          <div className="mt-1 text-sm leading-snug text-[#6B5A8C]">
            {description}
          </div>
        )}

        <div className="mt-4 grid grid-cols-5 gap-0">
          {RISK_STEPS.map(({ step }) => {
            const isActive = step === activeStep;
            return (
              <div key={step} className="flex flex-col items-center">
                <div className="relative flex h-4 w-full items-center">
                  {step > 1 && (
                    <div className="absolute right-1/2 h-[2px] w-full bg-[#DFC9FF]" />
                  )}
                  {isActive && (
                    <div className="absolute -top-3 left-1/2 h-2 w-2 -translate-x-1/2 rounded-full bg-[#7C3AED]" />
                  )}
                </div>
                <div
                  className={cls(
                    "flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-bold",
                    isActive
                      ? "bg-[#7C3AED] text-white"
                      : "bg-white text-slate-400",
                  )}
                >
                  {step}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="rounded-2xl border border-[#EDF1F7] bg-[#FBFCFF] p-4">
        <div className="mb-3 text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">
          Allocation
        </div>

        <div className="grid gap-0">
          {rows.map((row) => (
            <div
              key={row.key}
              className="grid grid-cols-[1fr_auto] items-center gap-x-3 gap-y-2 border-t border-[#EDF1F7] py-2.5 first:border-t-0 first:pt-0 last:pb-0"
            >
              <div className="text-sm font-semibold text-slate-700">
                {row.label}
              </div>
              <div className={cls("text-sm font-semibold", row.textClass)}>
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
