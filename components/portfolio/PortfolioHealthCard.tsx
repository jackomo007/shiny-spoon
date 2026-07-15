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
  pct: number;
  points: number;
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
  { step: 1, colorClass: "text-[#08B76A]" },
  { step: 2, colorClass: "text-[#08B76A]" },
  { step: 3, colorClass: "text-[#F5B400]" },
  { step: 4, colorClass: "text-[#F06B0B]" },
  { step: 5, colorClass: "text-[#F52159]" },
] as const;

const RISK_DESCRIPTIONS: Record<string, string> = {
  Conservative: "Mostly cash-like or lower-volatility exposure.",
  Balanced: "A measured mix of stability and growth exposure.",
  Growth: "Tilted toward upside while retaining some ballast.",
  Aggressive: "Concentrated in volatile positions with wider drawdown risk.",
  "Extremely Aggressive":
    "Highly speculative exposure with large swing potential.",
};

const RISK_INSIGHTS: Record<string, string> = {
  Conservative:
    "Your portfolio prioritizes stability and keeps volatility relatively contained.",
  Balanced:
    "Your portfolio is positioned for long-term growth while maintaining a healthy level of stability.",
  Growth:
    "Your portfolio leans toward growth assets, so periodic rebalancing can help keep risk intentional.",
  Aggressive:
    "Your portfolio has meaningful volatility exposure and may see wider drawdowns during market stress.",
  "Extremely Aggressive":
    "Your portfolio is heavily tilted toward speculative assets and can move sharply in both directions.",
};

function scoreLabel(score: number) {
  return Math.round(clamp(score));
}

export default function PortfolioHealthCard({
  assets,
}: {
  assets: HealthAsset[];
}) {
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
      pct: allocation.btc,
      points: RISK_POINTS.btc,
    },
    {
      pct: allocation.eth,
      points: RISK_POINTS.eth,
    },
    {
      pct: allocation.large,
      points: RISK_POINTS.large,
    },
    {
      pct: allocation.mid,
      points: RISK_POINTS.mid,
    },
    {
      pct: allocation.small,
      points: RISK_POINTS.small,
    },
    {
      pct: allocation.stable,
      points: RISK_POINTS.stable,
    },
  ];

  const score = clamp(
    rows.reduce((sum, row) => sum + (row.pct / 100) * row.points, 0),
  );
  const hasAssets = totalValue > 0;
  const profile = hasAssets ? profileFor(score) : "No Assets";
  const activeStep = hasAssets ? stepFor(score) : 0;
  const description = hasAssets ? RISK_DESCRIPTIONS[profile] : null;
  const insight = hasAssets
    ? RISK_INSIGHTS[profile]
    : "Add assets to see how your allocation shapes the portfolio risk profile.";
  const meterScore = hasAssets ? scoreLabel(score) : 0;

  return (
    <section className="w-full">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-2xl font-extrabold leading-none tracking-normal text-[#07142F]">
          Portfolio Health
        </h2>
        <button
          type="button"
          aria-label="Risk profile help"
          title="Your risk profile is derived from how your holdings are allocated across asset categories."
          className="flex h-9 w-9 items-center justify-center rounded-full border border-[#DFE5EF] bg-white text-sm font-extrabold text-[#07142F]"
        >
          ?
        </button>
      </div>

      <Card className="rounded-[20px] border-[#DFE5EF] p-5 shadow-[0_10px_24px_rgba(17,33,65,0.08)]">
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
          <div className="min-w-0">
            <div className="mb-2 text-xs font-bold uppercase tracking-[0.08em] text-[#6F7D98]">
              Risk Profile
            </div>
            <div className="break-words text-[28px] font-extrabold leading-[0.95] tracking-normal text-[#07142F]">
              {profile}
            </div>
          </div>

          <div className="shrink-0 rounded-xl bg-[#07142F] px-3 py-2 text-sm font-extrabold tracking-normal text-white">
            {meterScore}/100
          </div>
        </div>

        <div className="my-6 max-w-[520px] text-base leading-[1.45] text-[#6F7D98]">
          {description ??
            "Add portfolio positions to calculate your risk profile."}
        </div>

        <div className="relative mt-1 pt-9">
          {hasAssets ? (
            <div
              className="absolute top-0 grid -translate-x-1/2 justify-items-center gap-1.5"
              style={{ left: `${score}%` }}
            >
              <div className="whitespace-nowrap rounded-lg bg-[#07142F] px-2.5 py-1 text-xs font-extrabold text-white">
                {meterScore}
              </div>
              <div className="h-0 w-0 border-l-[7px] border-r-[7px] border-t-[10px] border-l-transparent border-r-transparent border-t-[#07142F]" />
            </div>
          ) : null}

          <div
            aria-label="Risk profile spectrum from conservative to extremely aggressive"
            className="grid h-[18px] grid-cols-5 overflow-hidden rounded-full"
          >
            <div className="bg-[#08B76A]" />
            <div className="bg-[#72CA3D]" />
            <div className="bg-[#F5B400]" />
            <div className="bg-[#F06B0B]" />
            <div className="bg-[#F52159]" />
          </div>

          <div className="mt-4 grid grid-cols-5 gap-2 text-center">
            {RISK_STEPS.map(({ step, colorClass }) => (
              <div key={step}>
                <span
                  className={cls(
                    "block text-base font-extrabold",
                    step === activeStep ? colorClass : "text-[#07142F]",
                  )}
                >
                  {step}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-7 flex items-start gap-3 rounded-2xl bg-[#F7F9FC] px-4 py-4 text-sm leading-[1.45] text-[#26385F]">
          <div
            aria-hidden="true"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[rgba(8,183,106,0.12)] text-lg font-bold text-[#08B76A]"
          >
            i
          </div>
          <div>{insight}</div>
        </div>
      </Card>
    </section>
  );
}
