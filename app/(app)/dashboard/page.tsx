"use client";

import { useDashboardData } from "@/lib/useDashboardData";

const STABLECOIN_SYMBOLS = new Set(["USDT", "USDC", "DAI"]);

const fmtUSD = (n: number | undefined | null) => {
  if (n === undefined || n === null) return "$0";
  return n.toLocaleString(undefined, {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });
};

const fmtPct = (n: number | undefined | null) => {
  if (n === undefined || n === null) return "0.0%";
  return `${n.toFixed(1)}%`;
};

const fmtDeltaPct = (n: number | undefined | null) => {
  if (n === undefined || n === null) return "0.0%";
  return `${n >= 0 ? "+" : "-"}${Math.abs(n).toFixed(1)}%`;
};

const fmtDeltaUsd = (n: number | undefined | null) => {
  if (n === undefined || n === null) return "$0";
  return `${n >= 0 ? "+" : "-"}${fmtUSD(Math.abs(n))}`;
};

function parseRefreshBucket(input: string | undefined) {
  if (!input) return null;
  const match = input.match(/^(\d{4})-(\d{2})-(\d{2})-(\d{2})00$/);
  if (!match) return null;

  const [, year, month, day, hour] = match;
  return {
    year: Number(year),
    month: Number(month),
    day: Number(day),
    hour: Number(hour),
  };
}

function formatGeneratedDate(
  input: string | undefined,
  refreshBucket: string | undefined,
) {
  const bucket = parseRefreshBucket(refreshBucket);
  if (bucket) {
    const approxDate = new Date(
      Date.UTC(bucket.year, bucket.month - 1, bucket.day, 12, 0, 0),
    );
    const formattedDate = approxDate.toLocaleDateString("en-US", {
      month: "short",
      day: "2-digit",
      year: "numeric",
    });
    const bucketHour12 =
      bucket.hour === 0
        ? 12
        : bucket.hour > 12
          ? bucket.hour - 12
          : bucket.hour;
    const bucketPeriod = bucket.hour >= 12 ? "PM" : "AM";
    return `- ${formattedDate} ${bucketHour12}:00 ${bucketPeriod} ET`;
  }

  if (!input) return "-";
  const parsed = new Date(input);
  if (Number.isNaN(parsed.getTime())) return "-";

  return `- ${parsed.toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone: "America/New_York",
  })} ET`;
}

function formatUpdatedAgo(input: string | undefined) {
  if (!input) return "-";

  const diffMs = Date.now() - new Date(input).getTime();
  const safeDiffMs = Number.isFinite(diffMs) ? Math.max(diffMs, 0) : 0;
  const minutes = Math.floor(safeDiffMs / 60_000);

  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;

  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function getTrendBadgeClass(trend: string) {
  const base =
    "inline-flex items-center rounded-full border px-3 py-1.5 text-[12px] font-extrabold";
  if (trend === "Bullish") {
    return `${base} border-green-200 bg-green-50 text-green-700`;
  }
  if (trend === "Bearish") {
    return `${base} border-red-200 bg-red-50 text-red-700`;
  }
  return `${base} border-amber-200 bg-amber-50 text-amber-700`;
}

function getThermometerBadgeClass(tone: string) {
  const base =
    "inline-flex w-fit items-center rounded-full border px-3.5 py-2.5 text-[15px] font-black";
  if (tone === "discounted") {
    return `${base} border-green-200 bg-green-50 text-green-700`;
  }
  if (tone === "fair") {
    return `${base} border-[rgba(124,58,237,0.18)] bg-[#F1EAFE] text-[#6D28D9]`;
  }
  if (tone === "overextended") {
    return `${base} border-amber-200 bg-amber-50 text-amber-700`;
  }
  if (tone === "euphoric") {
    return `${base} border-red-200 bg-red-50 text-red-700`;
  }
  return `${base} border-green-200 bg-green-50 text-green-700`;
}

function getSignalBadgeClass(signal: string) {
  if (signal === "Scale-Out") {
    return "inline-flex items-center rounded-[12px] border border-red-700/30 bg-red-700 px-3.5 py-2 text-[13px] font-extrabold text-red-50";
  }

  return "inline-flex items-center rounded-[12px] border border-green-700/30 bg-green-700 px-3.5 py-2 text-[13px] font-extrabold text-green-50";
}

function getFearGreedLabel(score: number | undefined) {
  if (score === undefined) return "-";
  if (score <= 24) return "Extreme Fear";
  if (score <= 44) return "Fear";
  if (score <= 55) return "Neutral";
  if (score <= 74) return "Greed";
  return "Extreme Greed";
}

function getFearGreedDescription(score: number | undefined) {
  if (score === undefined) {
    return "Market sentiment is currently unavailable.";
  }
  if (score <= 24) {
    return "Fear is dominant. Traders are highly defensive, which often appears during heavy uncertainty or capitulation-like conditions.";
  }
  if (score <= 44) {
    return "Sentiment is cautious. Traders are still defensive, and confidence remains weak until price strength improves.";
  }
  if (score <= 55) {
    return "Market sentiment is balanced. Traders are split between caution and optimism, which often fits range-bound conditions.";
  }
  if (score <= 74) {
    return "Greed is starting to lead sentiment. Traders are leaning risk-on, but strong follow-through is still needed to confirm expansion.";
  }
  return "Sentiment is overheated. Traders are aggressively risk-on, which can support momentum but also raises the chance of short-term excess.";
}

function clampAllocation(value: number) {
  return Math.min(100, Math.max(0, value));
}

export default function DashboardPage() {
  const {
    portfolio,
    marketGlobal,
    fearGreed,
    marketAnalysis,
    btcPrice,
    loading,
    error,
  } = useDashboardData();

  const totalPortfolioValue = portfolio?.summary.currentBalanceUsd ?? 0;
  const portfolio24hUsd = portfolio?.summary.portfolio24h.usd ?? 0;
  const portfolio24hPct = portfolio?.summary.portfolio24h.pct ?? 0;
  const assets = portfolio?.assets ?? [];

  const allocation = assets.reduce(
    (acc, asset) => {
      const value = asset.holdingsValueUsd ?? 0;
      if (!totalPortfolioValue) return acc;

      const weight = (value / totalPortfolioValue) * 100;

      if (asset.symbol === "BTC") acc.btc += weight;
      else if (asset.symbol === "ETH") acc.eth += weight;
      else if (STABLECOIN_SYMBOLS.has(asset.symbol)) acc.stables += weight;
      else acc.alts += weight;

      return acc;
    },
    { btc: 0, eth: 0, alts: 0, stables: 0 },
  );

  const normalizedAllocation = {
    btc: clampAllocation(allocation.btc),
    eth: clampAllocation(allocation.eth),
    alts: clampAllocation(allocation.alts),
    stables: clampAllocation(allocation.stables),
  };

  const analysis = marketAnalysis?.analysis ?? null;
  const thermometer = analysis?.thermometer ?? null;
  const analysisMeta = marketAnalysis?.meta;
  const analysisUnavailable = !loading && !analysis;
  const fearGreedScore = fearGreed?.current.score;
  const fearGreedLabel =
    fearGreed?.current.label ?? getFearGreedLabel(fearGreedScore);
  const fearGreedNarrative =
    fearGreed?.current.narrative ?? getFearGreedDescription(fearGreedScore);
  const fearGreedChange7d = fearGreed?.history.change7d;

  const portfolioValueLabel = portfolio ? fmtUSD(totalPortfolioValue) : "$0";
  const portfolioChangeLabel = portfolio
    ? `${fmtDeltaUsd(portfolio24hUsd)} (${fmtDeltaPct(portfolio24hPct)})`
    : "$0 (0.0%)";
  const btcSnapshotValue =
    analysisMeta?.currentBtcPrice ??
    (btcPrice ? fmtUSD(btcPrice.priceUsd) : "$0");
  const btcSnapshotDelta = btcPrice
    ? `24H: ${fmtDeltaPct(btcPrice.change24hPct)}`
    : "24H: 0.0%";
  const btcDominanceValue =
    marketGlobal?.dominance.btc !== undefined
      ? fmtPct(marketGlobal.dominance.btc)
      : "-%";
  const btcDominanceDelta = "24H: -";
  const bullishConfirmationLabel =
    analysis?.dashboardSummary.bullishConfirmation ??
    (analysisUnavailable ? "Unavailable" : "Loading");
  const bearishConfirmationLabel =
    analysis?.dashboardSummary.bearishBreakdown ??
    (analysisUnavailable ? "Unavailable" : "Loading");
  const analysisDate = formatGeneratedDate(
    analysisMeta?.generatedAt,
    analysisMeta?.refreshBucket,
  );
  const analysisUpdated = formatUpdatedAgo(analysisMeta?.generatedAt);
  const markerLeft = `${Math.max(0, Math.min(100, fearGreedScore ?? 50))}%`;

  if (error) {
    return (
      <main className="flex flex-col gap-4">
        <div className="rounded-[16px] border border-red-200 bg-red-50 p-6 text-center">
          <div className="mb-2 font-semibold text-red-600">
            Error Loading Dashboard
          </div>
          <div className="text-sm text-red-500">{error}</div>
        </div>
      </main>
    );
  }

  return (
    <main className="flex flex-col gap-[14px] text-[#14121A]">
      <section className="rounded-[16px] border border-[#E9E6F2] bg-white px-[18px] py-[14px]">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex flex-col gap-1">
            <div className="text-[11px] font-extrabold uppercase tracking-[0.06em] text-[#6B6777]">
              Total Portfolio Value
            </div>
            <div className="text-[26px] font-black text-[#14121A]">
              {loading ? "$0" : portfolioValueLabel}
            </div>
          </div>

          <div className="flex flex-col items-end gap-1">
            <div className="text-[11px] font-extrabold uppercase tracking-[0.06em] text-[#6B6777]">
              24H Change
            </div>
            <div
              className={`text-[13px] font-extrabold ${
                portfolio24hUsd >= 0 ? "text-green-600" : "text-red-600"
              }`}
            >
              {loading ? "$0 (0.0%)" : portfolioChangeLabel}
            </div>
          </div>
        </div>

        <div className="mt-[10px] flex flex-col gap-[6px]">
          <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 text-[11px] font-bold text-[#6B6777]">
            <span>BTC {Math.round(normalizedAllocation.btc)}%</span>
            <span>ETH {Math.round(normalizedAllocation.eth)}%</span>
            <span>Alts {Math.round(normalizedAllocation.alts)}%</span>
            <span>Stables {Math.round(normalizedAllocation.stables)}%</span>
          </div>
          <div className="flex h-2 overflow-hidden rounded-full bg-[#F3F4F6]">
            <div
              className="bg-[#F7931A]"
              style={{ width: `${normalizedAllocation.btc}%` }}
            />
            <div
              className="bg-[#627EEA]"
              style={{ width: `${normalizedAllocation.eth}%` }}
            />
            <div
              className="bg-[#7C3AED]"
              style={{ width: `${normalizedAllocation.alts}%` }}
            />
            <div
              className="bg-[#94A3B8]"
              style={{ width: `${normalizedAllocation.stables}%` }}
            />
          </div>
        </div>
      </section>

      <section className="grid gap-[14px] xl:grid-cols-[1.6fr_1fr]">
        <article className="flex min-h-full flex-col rounded-[16px] border border-[#E9E6F2] bg-white p-4">
          <div className="mb-4 flex items-start justify-between gap-4">
            <div className="flex items-start gap-3.5">
              <div className="grid h-[34px] w-[34px] place-items-center rounded-[12px] border border-[rgba(124,58,237,0.14)] bg-[rgba(124,58,237,0.08)] text-[17px] font-black text-[#6D28D9]">
                ₿
              </div>
              <div>
                <div className="flex flex-wrap items-center gap-2.5">
                  <h2 className="m-0 text-[20px] font-semibold tracking-[-0.02em] text-[#14121A]">
                    BTC Daily Analysis
                  </h2>
                  <span className="text-[13px] text-[#6B6777]">
                    {analysisDate}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="flex flex-1 flex-col justify-between rounded-[18px] border border-[rgba(124,58,237,0.12)] bg-[#FAFAFD] px-6 py-[22px]">
            <div>
              <div className="mb-3 flex flex-wrap items-start justify-between gap-5">
                <div>
                  <div className="mb-2 text-[11px] font-extrabold uppercase tracking-[0.08em] text-[#6B6777]">
                    Stakk Thermometer
                  </div>
                  <span
                    className={getThermometerBadgeClass(
                      thermometer?.tone ?? "undervalued",
                    )}
                  >
                    {thermometer?.label ??
                      (analysisUnavailable
                        ? "Market data unavailable"
                        : "Loading market data")}
                  </span>
                </div>

                <div className="flex min-w-[280px] items-center justify-between gap-3 rounded-[14px] border border-[rgba(124,58,237,0.10)] bg-white px-3.5 py-3">
                  <div className="flex flex-col gap-1">
                    <span className="text-[11px] font-extrabold uppercase tracking-[0.08em] text-[#6B6777]">
                      Market Structure
                    </span>
                    <span className="text-[13px] font-semibold text-[#6B6777]">
                      Current BTC structure
                    </span>
                  </div>
                  <span
                    className={getTrendBadgeClass(analysis?.marketTrend ?? "")}
                  >
                    {analysis?.marketTrend ??
                      (analysisUnavailable ? "Unavailable" : "Loading")}
                  </span>
                </div>
              </div>

              <p className="max-w-[95%] text-[15px] leading-7 text-[#6B6777]">
                {thermometer?.marketTrendCopy ??
                  (analysisUnavailable
                    ? "Bitcoin market analysis is currently unavailable."
                    : "Bitcoin market analysis is loading from live BTC data.")}
              </p>

              <div className="mt-3 rounded-[14px] border border-[rgba(124,58,237,0.12)] bg-white px-3.5 py-3 text-[14px] leading-[1.55] text-[#6B6777]">
                <strong className="text-[#14121A]">Stakk Insight:</strong>{" "}
                {thermometer?.stakkInsight ??
                  (analysisUnavailable
                    ? "The Stakk signal could not be generated from the latest BTC data."
                    : "The Stakk signal will appear as soon as BTC market data is available.")}
              </div>
            </div>

            <div className="mt-[18px] grid gap-[10px] md:grid-cols-3">
              <div className="flex min-h-[82px] flex-col justify-between rounded-[14px] border border-[rgba(124,58,237,0.10)] bg-white p-3">
                <div className="text-[11px] font-extrabold uppercase tracking-[0.08em] text-[#6B6777]">
                  200W MA
                </div>
                <div className="text-[15px] font-black leading-[1.35] text-[#14121A]">
                  {thermometer?.movingAverage ??
                    (analysisUnavailable ? "Unavailable" : "$0")}
                </div>
              </div>

              <div className="flex min-h-[82px] flex-col justify-between rounded-[14px] border border-[rgba(124,58,237,0.10)] bg-white p-3">
                <div className="text-[11px] font-extrabold uppercase tracking-[0.08em] text-[#6B6777]">
                  Distance
                </div>
                <div className="text-[15px] font-black leading-[1.35] text-[#14121A]">
                  {thermometer?.distance ??
                    (analysisUnavailable ? "Unavailable" : "0.0%")}
                </div>
              </div>

              <div className="flex min-h-[82px] flex-col justify-between rounded-[14px] border border-[rgba(124,58,237,0.10)] bg-white p-3">
                <div className="text-[11px] font-extrabold uppercase tracking-[0.08em] text-[#6B6777]">
                  Stakk Signal
                </div>
                <div className="mt-2">
                  <span
                    className={getSignalBadgeClass(thermometer?.signal ?? "")}
                  >
                    {thermometer?.signal ??
                      (analysisUnavailable ? "Unavailable" : "Loading")}
                  </span>
                </div>
              </div>
            </div>

            <div className="mt-4 flex items-center justify-between gap-3 border-t border-[#E9E6F2] pt-4">
              <div className="text-[13px] text-[#6B6777]">
                Updated <b>{analysisUpdated}</b>
              </div>
            </div>
          </div>
        </article>

        <article className="rounded-[16px] border border-[#E9E6F2] bg-white p-4">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h3 className="m-0 text-[16px] font-semibold tracking-[0.02em] text-[#14121A]">
              Today&apos;s Snapshot
            </h3>
            <span className="text-[13px] text-[#6B6777]">
              Auto-updated market data
            </span>
          </div>

          <div className="rounded-[14px] border border-[#E9E6F2] bg-white p-3">
            <div className="flex items-center justify-between gap-4">
              <div className="flex flex-col gap-1.5">
                <div className="flex items-center gap-2 text-[12px] font-extrabold uppercase tracking-[0.06em] text-[#6B6777]">
                  <span className="grid h-[22px] w-[22px] place-items-center rounded-[8px] bg-[#F1EAFE] text-[12px] font-black text-[#6D28D9]">
                    ₿
                  </span>
                  <span>BTC Price</span>
                </div>
                <div className="text-[22px] font-black text-[#14121A]">
                  {btcSnapshotValue}
                </div>
                <div
                  className={`text-[12px] ${
                    (btcPrice?.change24hPct ?? 0) >= 0
                      ? "text-green-600"
                      : "text-red-600"
                  }`}
                >
                  {btcSnapshotDelta}
                </div>
              </div>

              <div className="h-[72px] w-px bg-[#E9E6F2]" />

              <div className="flex flex-col items-end gap-1.5">
                <div className="flex items-center gap-2 text-[12px] font-extrabold uppercase tracking-[0.06em] text-[#6B6777]">
                  <span className="grid h-[22px] w-[22px] place-items-center rounded-[8px] bg-[#F1EAFE] text-[12px] font-black text-[#6D28D9]">
                    %
                  </span>
                  <span>BTC Dominance</span>
                </div>
                <div className="text-[22px] font-black text-[#14121A]">
                  {btcDominanceValue}
                </div>
                <div className="text-[12px] text-[#6B6777]">
                  {btcDominanceDelta}
                </div>
              </div>
            </div>
          </div>

          <div className="mt-3 flex flex-col gap-2.5">
            <div className="flex items-center justify-between gap-3 rounded-[14px] border border-[#E9E6F2] bg-[linear-gradient(180deg,#FFFFFF,#FBFAFF)] p-3.5">
              <div className="flex flex-col gap-1">
                <div className="text-[12px] font-extrabold uppercase tracking-[0.06em] text-[#6B6777]">
                  Bullish Confirmation
                </div>
                <div className="text-[13px] leading-[1.4] text-[#6B6777]">
                  BTC needs a clean break above the current range high.
                </div>
              </div>
              <span className="inline-flex shrink-0 items-center rounded-full border border-green-200 bg-green-50 px-3 py-1.5 text-[12px] font-extrabold text-green-700">
                {bullishConfirmationLabel}
              </span>
            </div>

            <div className="flex items-center justify-between gap-3 rounded-[14px] border border-[#E9E6F2] bg-[linear-gradient(180deg,#FFFFFF,#FBFAFF)] p-3.5">
              <div className="flex flex-col gap-1">
                <div className="text-[12px] font-extrabold uppercase tracking-[0.06em] text-[#6B6777]">
                  Bearish Confirmation
                </div>
                <div className="text-[13px] leading-[1.4] text-[#6B6777]">
                  BTC would lose bullish structure on a breakdown below support.
                </div>
              </div>
              <span className="inline-flex shrink-0 items-center rounded-full border border-red-200 bg-red-50 px-3 py-1.5 text-[12px] font-extrabold text-red-700">
                {bearishConfirmationLabel}
              </span>
            </div>
          </div>

          <div className="mt-[14px] flex flex-col gap-[10px] border-t border-[#E9E6F2] pt-[14px]">
            <div className="flex items-center justify-between gap-3">
              <div className="text-[12px] font-extrabold uppercase tracking-[0.06em] text-[#6B6777]">
                Fear &amp; Greed Index
              </div>
              <div className="text-[12px] text-[#6B6777]">
                7D:{" "}
                {fearGreedChange7d === null || fearGreedChange7d === undefined
                  ? "-"
                  : `${fearGreedChange7d > 0 ? "+" : ""}${fearGreedChange7d}`}
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="text-[22px] font-black text-[#14121A]">
                {fearGreedScore ?? "-"}
              </div>
              <span className="inline-flex items-center rounded-full border border-[rgba(124,58,237,0.18)] bg-[#F1EAFE] px-3 py-1.5 text-[12px] font-extrabold text-[#6D28D9]">
                {fearGreedLabel}
              </span>
            </div>

            <div className="relative h-2 overflow-hidden rounded-full bg-[linear-gradient(90deg,#DC2626_0%,#F59E0B_45%,#16A34A_100%)]">
              <div
                className="absolute top-[-4px] h-4 w-[2px] rounded-full bg-[#14121A]"
                style={{
                  left: markerLeft,
                  transform: "translateX(-50%)",
                }}
              />
            </div>

            <p className="text-[12px] leading-[1.45] text-[#6B6777]">
              {fearGreedNarrative}
            </p>
          </div>
        </article>
      </section>
    </main>
  );
}
