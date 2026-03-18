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
  if (n === undefined || n === null) return "▲ 0.0%";
  return `${n >= 0 ? "▲" : "▼"} ${Math.abs(n).toFixed(1)}%`;
};

const fmtDeltaUsd = (n: number | undefined | null) => {
  if (n === undefined || n === null) return "▲ $0";
  return `${n >= 0 ? "▲" : "▼"} ${fmtUSD(Math.abs(n))}`;
};

function parseBucketDate(bucket: string | undefined) {
  if (!bucket) return null;
  const [year, month, day] = bucket.split("-").slice(0, 3).map(Number);
  if (!year || !month || !day) return null;
  return new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
}

function formatBucketDate(bucket: string | undefined) {
  const parsed = parseBucketDate(bucket);
  if (!parsed) return "—";
  return parsed.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "2-digit",
  });
}

function formatUpdatedAgo(input: string | undefined) {
  if (!input) return "—";

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

function getFearGreedBadgeClass() {
  return "bg-[#F1EAFE] border-[rgba(124,58,237,0.18)] text-[#6D28D9]";
}

function getSentimentBadgeClass(sentiment: string) {
  const base =
    "inline-flex items-center rounded-full border px-3 py-1.5 text-[12px] font-extrabold";
  if (sentiment === "Bullish") {
    return `${base} bg-green-50 border-green-200 text-green-700`;
  }
  if (sentiment === "Bearish") {
    return `${base} bg-red-50 border-red-200 text-red-700`;
  }
  return `${base} bg-gray-100 border-gray-200 text-gray-700`;
}

function getMeaningBadgeClass(tone: "bullish" | "neutral" | "bearish") {
  if (tone === "bullish") return "bg-green-50 text-green-700";
  if (tone === "bearish") return "bg-red-50 text-red-700";
  return "bg-gray-100 text-gray-700";
}

function SnapshotMetric({
  icon,
  label,
  value,
  delta,
  deltaTone = "neutral",
}: {
  icon: string;
  label: string;
  value: string;
  delta: string;
  deltaTone?: "positive" | "negative" | "neutral";
}) {
  return (
    <div className="rounded-[14px] border border-[#E9E6F2] bg-[linear-gradient(180deg,#fff,#FBFAFF)] p-3">
      <div className="flex items-center gap-2 text-[12px] font-extrabold uppercase tracking-[0.06em] text-[#6B6777]">
        <span className="grid h-[22px] w-[22px] place-items-center rounded-[8px] bg-[#F1EAFE] text-[12px] font-black text-[#6D28D9]">
          {icon}
        </span>
        <span>{label}</span>
      </div>
      <div className="mt-1.5 text-[22px] font-black text-[#14121A]">{value}</div>
      <div
        className={`mt-1 text-[12px] ${
          deltaTone === "positive"
            ? "text-green-600"
            : deltaTone === "negative"
              ? "text-red-600"
              : "text-[#6B6777]"
        }`}
      >
        {delta}
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const {
    portfolio,
    marketGlobal,
    fearGreed,
    marketAnalysis,
    btcPrice,
    ethPrice,
    loading,
    error,
  } = useDashboardData();

  if (loading) {
    return (
      <main className="flex flex-col gap-4">
        <div className="rounded-[20px] border border-[#E9E6F2] bg-white p-5 shadow-[0_10px_30px_rgba(20,18,26,0.06)] animate-pulse">
          <div className="h-3 w-40 rounded bg-gray-200" />
          <div className="mt-3 h-10 w-52 rounded bg-gray-200" />
          <div className="mt-6 h-2 w-full rounded-full bg-gray-200" />
        </div>

        <div className="grid gap-4 xl:grid-cols-[1.6fr_1fr]">
          <div className="rounded-[20px] border border-[#E9E6F2] bg-white p-5 shadow-[0_10px_30px_rgba(20,18,26,0.06)] animate-pulse">
            <div className="h-56 rounded-[18px] bg-gray-200" />
          </div>
          <div className="rounded-[20px] border border-[#E9E6F2] bg-white p-5 shadow-[0_10px_30px_rgba(20,18,26,0.06)] animate-pulse">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="h-28 rounded-[14px] bg-gray-200" />
              <div className="h-28 rounded-[14px] bg-gray-200" />
              <div className="h-28 rounded-[14px] bg-gray-200" />
              <div className="h-28 rounded-[14px] bg-gray-200" />
            </div>
          </div>
        </div>

        <div className="rounded-[20px] border border-[#E9E6F2] bg-white p-5 shadow-[0_10px_30px_rgba(20,18,26,0.06)] animate-pulse">
          <div className="h-48 rounded-[18px] bg-gray-200" />
        </div>
      </main>
    );
  }

  if (error) {
    return (
      <main className="flex flex-col gap-4">
        <div className="rounded-[20px] border border-red-200 bg-red-50 p-6 text-center">
          <div className="mb-2 font-semibold text-red-600">
            Error Loading Dashboard
          </div>
          <div className="text-sm text-red-500">{error}</div>
        </div>
      </main>
    );
  }

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

  const fearGreedScore = fearGreed?.current.score;
  const fearGreedLabel = fearGreed?.current.label ?? "—";
  const fearGreedNarrative =
    fearGreed?.current.narrative ??
    "Fear & Greed data is currently unavailable.";
  const fearGreedChange7d = fearGreed?.history.change7d;
  const analysis = marketAnalysis?.analysis ?? null;
  const analysisMeta = marketAnalysis?.meta;
  const analysisHeadline =
    analysis?.marketTrend?.split("—")[0]?.trim() ??
    analysis?.sentiment ??
    "—";
  const analysisDate = formatBucketDate(analysisMeta?.refreshBucket);
  const analysisUpdated = formatUpdatedAgo(analysisMeta?.generatedAt);
  const portfolioValueLabel = portfolio ? fmtUSD(totalPortfolioValue) : "$—";
  const portfolioChangeLabel = portfolio
    ? `${fmtDeltaUsd(portfolio24hUsd)} (${fmtDeltaPct(portfolio24hPct)})`
    : "—";
  const marketCapLabel =
    marketGlobal?.totalMarketCap.formatted ??
    analysisMeta?.currentTotalMarketCap ??
    "$—";
  const btcSnapshotValue = btcPrice ? fmtUSD(btcPrice.priceUsd) : "$—";
  const btcSnapshotDelta = btcPrice
    ? `24H: ${fmtDeltaPct(btcPrice.change24hPct)}`
    : "24H: —";
  const ethSnapshotValue = ethPrice ? fmtUSD(ethPrice.priceUsd) : "$—";
  const ethSnapshotDelta = ethPrice
    ? `24H: ${fmtDeltaPct(ethPrice.change24hPct)}`
    : "24H: —";
  const totalSnapshotValue = marketGlobal?.totalMarketCap.formatted ?? "$—";
  const totalSnapshotDelta = marketGlobal
    ? `24H: ${fmtDeltaPct(marketGlobal.totalMarketCap.change24hPct)}`
    : "24H: —";
  const btcDominanceValue =
    marketGlobal?.dominance.btc !== undefined
      ? fmtPct(marketGlobal.dominance.btc)
      : "—%";
  const btcDominanceDelta = "24H: —";

  const dashboardRows = [
    {
      icon: "↗",
      tone: "bullish" as const,
      label: "Bullish Confirmation",
      sublabel: "Upside continuation signal",
      level:
        analysis?.dashboardSummary.bullishConfirmation ?? "Break above $—",
      tag: "Trigger",
      meaning: "Expansion likely",
    },
    {
      icon: "•",
      tone: "neutral" as const,
      label: "Neutral Range",
      sublabel: "Current market condition",
      level: analysis?.dashboardSummary.neutralRange ?? "$—",
      tag: "Range",
      meaning: "Consolidation",
    },
    {
      icon: "↘",
      tone: "bearish" as const,
      label: "Bearish Breakdown",
      sublabel: "Loss of key demand",
      level:
        analysis?.dashboardSummary.bearishBreakdown ?? "Below $—",
      tag: "Breakdown",
      meaning: "Correction risk",
    },
  ];

  return (
    <main className="flex flex-col gap-4 text-[#14121A]">
      <section className="rounded-[20px] border border-[#E9E6F2] bg-white px-[18px] py-[14px] shadow-[0_10px_30px_rgba(20,18,26,0.06)]">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex flex-col gap-1">
            <div className="text-[11px] font-extrabold uppercase tracking-[0.06em] text-[#6B6777]">
              Total Portfolio Value
            </div>
            <div className="text-[26px] font-black text-[#14121A]">
              {portfolioValueLabel}
            </div>
          </div>

          <div className="flex flex-col items-end gap-1">
            <div className="text-[11px] font-extrabold uppercase tracking-[0.06em] text-[#6B6777]">
              24H Change
            </div>
            <div
              className={`text-[13px] font-extrabold ${
                portfolio
                  ? portfolio24hUsd >= 0
                    ? "text-green-600"
                    : "text-red-600"
                  : "text-[#6B6777]"
              }`}
            >
              {portfolioChangeLabel}
            </div>
          </div>
          </div>

        <div className="mt-5 flex flex-col gap-2">
          <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 text-[11px] font-bold">
            <span className="inline-flex items-center gap-1.5 text-[#F7931A]">
              <span className="h-2 w-2 rounded-full bg-[#F7931A]" />
              BTC {Math.round(normalizedAllocation.btc)}%
            </span>
            <span className="inline-flex items-center gap-1.5 text-[#627EEA]">
              <span className="h-2 w-2 rounded-full bg-[#627EEA]" />
              ETH {Math.round(normalizedAllocation.eth)}%
            </span>
            <span className="inline-flex items-center gap-1.5 text-[#7C3AED]">
              <span className="h-2 w-2 rounded-full bg-[#7C3AED]" />
              Alts {Math.round(normalizedAllocation.alts)}%
            </span>
            <span className="inline-flex items-center gap-1.5 text-[#16A34A]">
              <span className="h-2 w-2 rounded-full bg-[#16A34A]" />
              Stables {Math.round(normalizedAllocation.stables)}%
            </span>
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
              className="bg-[#16A34A]"
              style={{ width: `${normalizedAllocation.stables}%` }}
            />
          </div>
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.6fr_1fr]">
        <article className="flex min-h-full flex-col rounded-[20px] border border-[#E9E6F2] bg-[radial-gradient(circle_at_top_right,rgba(124,58,237,0.10),transparent_30%),linear-gradient(180deg,#FFFFFF,#FCFBFF)] p-4 shadow-[0_10px_30px_rgba(20,18,26,0.06)]">
          <div className="mb-4 flex items-start justify-between gap-4">
            <div className="flex items-start gap-3.5">
              <div className="grid h-[46px] w-[46px] place-items-center rounded-[16px] border border-[rgba(124,58,237,0.14)] bg-[linear-gradient(135deg,rgba(124,58,237,0.14),rgba(124,58,237,0.06))] text-[15px] font-black text-[#6D28D9] shadow-[inset_0_1px_0_rgba(255,255,255,0.8)]">
                AI
              </div>

              <div>
                <div className="flex flex-wrap items-center gap-2.5">
                  <h2 className="m-0 text-[20px] font-semibold tracking-[-0.02em] text-[#14121A]">
                    AI Daily Market Analysis
                  </h2>
                  <span className="text-[13px] text-[#6B6777]">
                    {analysisDate}
                  </span>
                </div>

                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <span
                    className={getSentimentBadgeClass(
                      analysis?.sentiment ?? "Unavailable",
                    )}
                  >
                    Market Sentiment: {analysis?.sentiment ?? "—"}
                  </span>
                  <span className="inline-flex items-center rounded-full border border-[#E9E6F2] bg-[#FAFAFD] px-3 py-1.5 text-[12px] font-bold text-[#6B6777]">
                    TOTAL: {marketCapLabel}
                  </span>
                  <span className="inline-flex items-center rounded-full border border-[#E9E6F2] bg-[#FAFAFD] px-3 py-1.5 text-[12px] font-bold text-[#6B6777]">
                    Phase: {analysis?.phase ?? "—"}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="flex flex-1 flex-col gap-4">
            <div className="flex flex-1 flex-col justify-between rounded-[18px] border border-[rgba(124,58,237,0.12)] bg-[linear-gradient(180deg,rgba(124,58,237,0.05),rgba(124,58,237,0.02))] px-6 py-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.9)]">
              <div>
                <div className="mb-2 text-[11px] font-extrabold uppercase tracking-[0.08em] text-[#6B6777]">
                  Market Trend
                </div>
                <div className="mb-2 text-[20px] font-black tracking-[-0.02em] text-[#14121A]">
                  {analysisHeadline}
                </div>
                <p className="max-w-[95%] text-[15px] leading-7 text-[#6B6777]">
                  {analysis?.marketTrend ?? "—"}
                </p>
              </div>

              <div className="mt-5 grid gap-2.5 md:grid-cols-3">
                <div className="flex min-h-[84px] flex-col justify-between rounded-[14px] border border-[rgba(124,58,237,0.10)] bg-white/75 p-3 shadow-[0_6px_18px_rgba(20,18,26,0.03)]">
                  <div className="text-[11px] font-extrabold uppercase tracking-[0.08em] text-[#6B6777]">
                    Support
                  </div>
                  <div className="text-[15px] font-black leading-[1.35] text-[#14121A]">
                    {analysis?.support ?? "$—"}
                  </div>
                </div>

                <div className="flex min-h-[84px] flex-col justify-between rounded-[14px] border border-[rgba(124,58,237,0.10)] bg-white/75 p-3 shadow-[0_6px_18px_rgba(20,18,26,0.03)]">
                  <div className="text-[11px] font-extrabold uppercase tracking-[0.08em] text-[#6B6777]">
                    Resistance
                  </div>
                  <div className="text-[15px] font-black leading-[1.35] text-[#14121A]">
                    {analysis?.resistance ?? "$—"}
                  </div>
                </div>

                <div className="flex min-h-[84px] flex-col justify-between rounded-[14px] border border-[rgba(124,58,237,0.10)] bg-white/75 p-3 shadow-[0_6px_18px_rgba(20,18,26,0.03)]">
                  <div className="text-[11px] font-extrabold uppercase tracking-[0.08em] text-[#6B6777]">
                    Structure
                  </div>
                  <div className="text-[15px] font-black leading-[1.35] text-[#14121A]">
                    {analysis?.structure ?? "—"}
                  </div>
                </div>
              </div>

            </div>
          </div>

          <div className="mt-4 flex items-center justify-between gap-3 border-t border-[#E9E6F2] pt-4">
            <div className="text-[13px] text-[#6B6777]">
              Updated <b>{analysisUpdated}</b>
            </div>
            <div className="text-[13px] text-[#6B6777]">
              Next refresh <b>{analysisMeta?.scheduledRefresh ?? "Every 4 hours from 9:00 AM ET"}</b>
            </div>
          </div>
        </article>

        <article className="rounded-[20px] border border-[#E9E6F2] bg-white p-4 shadow-[0_10px_30px_rgba(20,18,26,0.06)]">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h3 className="m-0 text-[16px] font-semibold tracking-[0.02em] text-[#14121A]">
              Today&apos;s Snapshot
            </h3>
            <span className="text-[13px] text-[#6B6777]">
              Auto-updated market data
            </span>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <SnapshotMetric
              icon="₿"
              label="BTC Price"
              value={btcSnapshotValue}
              delta={btcSnapshotDelta}
              deltaTone={(btcPrice?.change24hPct ?? 0) >= 0 ? "positive" : "negative"}
            />
            <SnapshotMetric
              icon="◎"
              label="ETH Price"
              value={ethSnapshotValue}
              delta={ethSnapshotDelta}
              deltaTone={(ethPrice?.change24hPct ?? 0) >= 0 ? "positive" : "negative"}
            />
            <SnapshotMetric
              icon="Σ"
              label="TOTAL Market Cap"
              value={totalSnapshotValue}
              delta={totalSnapshotDelta}
              deltaTone={
                (marketGlobal?.totalMarketCap.change24hPct ?? 0) >= 0
                  ? "positive"
                  : "negative"
              }
            />
            <SnapshotMetric
              icon="%"
              label="BTC Dominance"
              value={btcDominanceValue}
              delta={btcDominanceDelta}
              deltaTone="neutral"
            />
          </div>

          <div className="mt-[14px] flex flex-col gap-[10px] border-t border-[#E9E6F2] pt-[14px]">
            <div className="flex items-center justify-between gap-3">
              <div className="text-[12px] font-extrabold uppercase tracking-[0.06em] text-[#6B6777]">
                Fear &amp; Greed Index
              </div>
              <div className="text-[12px] text-[#6B6777]">
                7D:{" "}
                {fearGreedChange7d === null || fearGreedChange7d === undefined
                  ? "—"
                  : `${fearGreedChange7d > 0 ? "+" : ""}${fearGreedChange7d}`}
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="text-[22px] font-black text-[#14121A]">
                {fearGreedScore ?? "—"}
              </div>
              <span
                className={`inline-flex items-center rounded-full border px-3 py-1.5 text-[12px] font-extrabold ${getFearGreedBadgeClass()}`}
              >
                {fearGreedLabel}
              </span>
            </div>

            <div className="relative h-2 overflow-hidden rounded-full bg-[linear-gradient(90deg,#DC2626_0%,#F59E0B_45%,#16A34A_100%)]">
              <div
                className="absolute top-[-4px] h-4 w-[2px] rounded-full bg-[#14121A]"
                style={{
                  left: `${fearGreedScore ?? 50}%`,
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

      <section className="rounded-[20px] border border-[#E9E6F2] bg-white p-4 shadow-[0_10px_30px_rgba(20,18,26,0.06)]">
        <div className="mb-4 flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="grid h-[42px] w-[42px] place-items-center rounded-[14px] bg-[#F1EAFE] text-[16px] font-black text-[#6D28D9] shadow-[inset_0_0_0_1px_rgba(124,58,237,0.10)]">
              📋
            </div>
            <div>
              <h3 className="m-0 text-[18px] tracking-[0.02em] text-[#14121A]">
                Dashboard Summary
              </h3>
              <div className="mt-1 text-[13px] text-[#6B6777]">
                Key TOTAL levels that define the next market move
              </div>
            </div>
          </div>

          <span className="inline-flex items-center rounded-full border border-[rgba(124,58,237,0.18)] bg-[#F1EAFE] px-3 py-1.5 text-[12px] font-extrabold text-[#6D28D9]">
            TOTAL Market Cap
          </span>
        </div>

        <div className="overflow-hidden rounded-[18px] border border-[#E9E6F2] bg-[linear-gradient(180deg,#FFFFFF,#FCFBFF)] shadow-[0_10px_26px_rgba(20,18,26,0.04)]">
          <div className="hidden grid-cols-[1.5fr_1fr_1fr] border-b border-[#E9E6F2] bg-[#FBFAFE] px-[18px] py-[14px] text-[11px] font-black uppercase tracking-[0.08em] text-[#6B6777] md:grid">
            <div>Scenario</div>
            <div>Level</div>
            <div>Market Meaning</div>
          </div>

          <div className="divide-y divide-[#E9E6F2]">
            {dashboardRows.map((row) => (
              <div
                key={row.label}
                className="grid gap-4 px-[18px] py-[18px] md:grid-cols-[1.5fr_1fr_1fr] md:items-center"
              >
                <div className="flex items-center gap-3">
                  <span
                    className={`grid h-[34px] w-[34px] place-items-center rounded-[12px] text-[14px] font-black ${
                      row.tone === "bullish"
                        ? "bg-green-50 text-green-700"
                        : row.tone === "bearish"
                          ? "bg-red-50 text-red-700"
                          : "bg-gray-100 text-gray-600"
                    }`}
                  >
                    {row.icon}
                  </span>
                  <div className="flex flex-col gap-0.5">
                    <span className="text-[14px] font-extrabold text-[#14121A]">
                      {row.label}
                    </span>
                    <span className="text-[12px] text-[#6B6777]">
                      {row.sublabel}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <span className="text-[15px] font-black text-[#14121A]">
                    {row.level}
                  </span>
                  <span className="inline-flex items-center rounded-full border border-[rgba(124,58,237,0.12)] bg-[#F6F3FD] px-2 py-1 text-[11px] font-extrabold text-[#6D28D9]">
                    {row.tag}
                  </span>
                </div>

                <div>
                  <span
                    className={`inline-flex items-center rounded-full px-3 py-1.5 text-[12px] font-extrabold ${getMeaningBadgeClass(
                      row.tone,
                    )}`}
                  >
                    {row.meaning}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-[14px] flex flex-wrap items-center justify-between gap-3">
          <div className="text-[12px] font-bold text-[#6B6777]">
            Use these TOTAL levels as the main market roadmap for confirmation,
            range conditions, and breakdown risk.
          </div>
        </div>
      </section>
    </main>
  );
}

function clampAllocation(value: number) {
  return Math.min(100, Math.max(0, value));
}
