"use client";

import { useDashboardData } from "@/lib/useDashboardData";

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

const fmtDelta = (n: number | undefined | null, suffix = "%") => {
  if (n === undefined || n === null) return "±0.0%";
  return `${n >= 0 ? "▲" : "▼"} ${Math.abs(n).toFixed(1)}${suffix}`;
};

export default function DashboardPage() {
  const {
    portfolio,
    marketGlobal,
    fearGreed,
    marketAnalysis,
    btcLevels,
    btcPrice,
    ethPrice,
    loading,
    error,
  } = useDashboardData();

  const getSentimentBadgeClass = (sentiment: string) => {
    const base =
      "inline-flex items-center gap-2 px-3 py-2 rounded-full text-xs font-extrabold border";
    if (sentiment === "Bullish")
      return `${base} bg-green-100 border-green-300 text-green-700`;
    if (sentiment === "Bearish")
      return `${base} bg-red-100 border-red-300 text-red-700`;
    return `${base} bg-gray-100 border-gray-300 text-gray-700`;
  };

  const niceDate = new Date().toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "2-digit",
  });

  if (loading) {
    return (
      <main className="flex flex-col gap-4">
        <div className="grid" style={{ gridTemplateColumns: "1fr" }}>
          <div className="bg-white border border-gray-200 rounded-2xl shadow-lg p-4 animate-pulse">
            <div className="h-8 bg-gray-200 rounded w-48 mb-4"></div>
            <div className="h-4 bg-gray-200 rounded w-full"></div>
          </div>
        </div>

        <div className="grid gap-4 grid-cols-1 xl:grid-cols-[1.6fr_1fr]">
          <div className="bg-white border border-gray-200 rounded-2xl shadow-lg p-4 animate-pulse">
            <div className="h-64 bg-gray-200 rounded"></div>
          </div>
          <div className="bg-white border border-gray-200 rounded-2xl shadow-lg p-4 animate-pulse">
            <div className="h-64 bg-gray-200 rounded"></div>
          </div>
        </div>
      </main>
    );
  }

  if (error) {
    return (
      <main className="flex flex-col gap-4">
        <div className="bg-red-50 border border-red-200 rounded-2xl p-6 text-center">
          <div className="text-red-600 font-semibold mb-2">
            Error Loading Dashboard
          </div>
          <div className="text-red-500 text-sm">{error}</div>
        </div>
      </main>
    );
  }

  const calculateAllocation = () => {
    if (!portfolio?.assets || portfolio.assets.length === 0) {
      return { btc: 60, eth: 25, alts: 10, stables: 5 };
    }

    const totalValue = portfolio.summary.currentBalanceUsd;
    if (totalValue === 0) return { btc: 0, eth: 0, alts: 0, stables: 100 };

    const btcAsset = portfolio.assets.find((a) => a.symbol === "BTC");
    const ethAsset = portfolio.assets.find((a) => a.symbol === "ETH");

    const btcPct = btcAsset
      ? (btcAsset.holdingsValueUsd / totalValue) * 100
      : 0;
    const ethPct = ethAsset
      ? (ethAsset.holdingsValueUsd / totalValue) * 100
      : 0;
    const altsPct = Math.max(0, 100 - btcPct - ethPct - 5);
    const stablesPct = Math.max(5, 100 - btcPct - ethPct - altsPct);

    return {
      btc: Math.round(btcPct),
      eth: Math.round(ethPct),
      alts: Math.round(altsPct),
      stables: Math.round(stablesPct),
    };
  };

  const allocation = calculateAllocation();

  return (
    <main className="flex flex-col gap-4">
      <div className="grid" style={{ gridTemplateColumns: "1fr" }}>
        <article
          className="bg-white border border-gray-200 rounded-2xl shadow-lg flex flex-col gap-3"
          style={{ padding: "14px 18px" }}
        >
          <div className="flex items-center justify-between">
            <div className="flex flex-col gap-1">
              <div className="text-xs font-extrabold tracking-wider uppercase text-gray-500">
                Total Portfolio Value
              </div>
              <div className="text-3xl font-black text-gray-900">
                {portfolio ? fmtUSD(portfolio.summary.currentBalanceUsd) : "$0"}
              </div>
            </div>

            <div className="flex flex-col items-end gap-1">
              <div className="text-xs font-extrabold uppercase text-gray-500">
                24H Change
              </div>
              <div
                className={`text-sm font-extrabold ${
                  (portfolio?.summary.portfolio24h.usd ?? 0) >= 0
                    ? "text-green-600"
                    : "text-red-600"
                }`}
              >
                {portfolio
                  ? `${fmtDelta(portfolio.summary.portfolio24h.usd, "")} (${fmtDelta(portfolio.summary.portfolio24h.pct)})`
                  : "▲ $0 (0.0%)"}
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <div className="flex justify-between text-xs font-bold text-gray-500">
              <span>BTC {allocation.btc}%</span>
              <span>ETH {allocation.eth}%</span>
              <span>Alts {allocation.alts}%</span>
              <span>Stables {allocation.stables}%</span>
            </div>
            <div className="flex h-2 rounded-full overflow-hidden bg-gray-100">
              <div
                className="bg-orange-500"
                style={{ width: `${allocation.btc}%` }}
              ></div>
              <div
                className="bg-blue-500"
                style={{ width: `${allocation.eth}%` }}
              ></div>
              <div
                className="bg-purple-600"
                style={{ width: `${allocation.alts}%` }}
              ></div>
              <div
                className="bg-slate-400"
                style={{ width: `${allocation.stables}%` }}
              ></div>
            </div>
          </div>
        </article>
      </div>

      <div className="grid gap-4 grid-cols-1 xl:grid-cols-[1.6fr_1fr]">
        <article className="bg-white border border-gray-200 rounded-2xl shadow-lg p-4 flex flex-col">
          <div className="flex items-start justify-between gap-3 mb-4">
            <div className="flex gap-3 items-start">
              <div className="w-10 h-10 rounded-xl bg-purple-100 flex items-center justify-center text-purple-600 font-black">
                AI
              </div>
              <div>
                <div className="flex gap-3 items-center flex-wrap">
                  <h2 className="text-lg font-semibold tracking-wide text-gray-900 m-0">
                    AI Daily Market Analysis
                  </h2>
                  <span className="text-sm text-gray-500">
                    — {niceDate}, 9:00 AM EST
                  </span>
                </div>
                <div className="flex gap-2 items-center flex-wrap mt-2">
                  <span
                    className={getSentimentBadgeClass(
                      marketAnalysis?.analysis.sentiment ?? "Neutral",
                    )}
                  >
                    Market Sentiment:{" "}
                    {marketAnalysis?.analysis.sentiment ?? "Neutral"}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <ul className="flex-grow my-3 pl-5 text-gray-900 text-sm leading-relaxed list-disc">
            {marketAnalysis?.analysis.bullets.map((bullet, index) => (
              <li key={index} className="my-2">
                {bullet}
              </li>
            )) ?? <li className="my-2">Loading market analysis...</li>}
          </ul>

          <div className="flex items-center justify-between gap-3 mt-auto pt-4 border-t border-gray-200">
            <div className="text-sm text-gray-500">
              Updated <strong>6m ago</strong>
            </div>
          </div>
        </article>

        <article className="bg-white border border-gray-200 rounded-2xl shadow-lg p-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold tracking-wide text-gray-900">
              Today&apos;s Snapshot
            </h3>
            <span className="text-sm text-gray-500">Real-time data</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
            <div className="border border-gray-200 rounded-xl p-3 bg-gradient-to-b from-white to-purple-50">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-6 h-6 rounded-lg bg-purple-100 flex items-center justify-center text-purple-600 text-xs font-black">
                  ₿
                </div>
                <span className="text-xs font-extrabold text-gray-500 uppercase tracking-wider">
                  BTC Price
                </span>
              </div>
              <div className="text-xl font-black text-gray-900 mt-2">
                {btcPrice ? fmtUSD(btcPrice.priceUsd) : "$0"}
              </div>
              <div className="text-xs text-gray-500 mt-1">
                24H:{" "}
                <span
                  className={`${(btcPrice?.change24hPct ?? 0) >= 0 ? "text-green-600" : "text-red-600"}`}
                >
                  {fmtDelta(btcPrice?.change24hPct)}
                </span>
              </div>
            </div>

            <div className="border border-gray-200 rounded-xl p-3 bg-gradient-to-b from-white to-purple-50">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-6 h-6 rounded-lg bg-purple-100 flex items-center justify-center text-purple-600 text-xs font-black">
                  ◎
                </div>
                <span className="text-xs font-extrabold text-gray-500 uppercase tracking-wider">
                  ETH Price
                </span>
              </div>
              <div className="text-xl font-black text-gray-900 mt-2">
                {ethPrice ? fmtUSD(ethPrice.priceUsd) : "$0"}
              </div>
              <div className="text-xs text-gray-500 mt-1">
                24H:{" "}
                <span
                  className={`${(ethPrice?.change24hPct ?? 0) >= 0 ? "text-green-600" : "text-red-600"}`}
                >
                  {fmtDelta(ethPrice?.change24hPct)}
                </span>
              </div>
            </div>

            <div className="border border-gray-200 rounded-xl p-3 bg-gradient-to-b from-white to-purple-50">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-6 h-6 rounded-lg bg-purple-100 flex items-center justify-center text-purple-600 text-xs font-black">
                  Σ
                </div>
                <span className="text-xs font-extrabold text-gray-500 uppercase tracking-wider">
                  TOTAL Market Cap
                </span>
              </div>
              <div className="text-xl font-black text-gray-900 mt-2">
                {marketGlobal?.totalMarketCap.formatted ?? "$0.00T"}
              </div>
              <div className="text-xs text-gray-500 mt-1">
                24H:{" "}
                <span
                  className={`${(marketGlobal?.totalMarketCap.change24hPct ?? 0) >= 0 ? "text-green-600" : "text-red-600"}`}
                >
                  {fmtDelta(marketGlobal?.totalMarketCap.change24hPct)}
                </span>
              </div>
            </div>

            <div className="border border-gray-200 rounded-xl p-3 bg-gradient-to-b from-white to-purple-50">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-6 h-6 rounded-lg bg-purple-100 flex items-center justify-center text-purple-600 text-xs font-black">
                  %
                </div>
                <span className="text-xs font-extrabold text-gray-500 uppercase tracking-wider">
                  BTC Dominance
                </span>
              </div>
              <div className="text-xl font-black text-gray-900 mt-2">
                {fmtPct(marketGlobal?.dominance.btc)}
              </div>
              <div className="text-xs text-gray-500 mt-1">
                24H: <span className="text-gray-600">±0.3%</span>
              </div>
            </div>
          </div>

          <div className="mt-3 pt-3 border-t border-gray-200 flex gap-3 items-center justify-between">
            <div className="text-sm text-gray-500">
              <strong>Fear &amp; Greed:</strong>{" "}
              <span className="font-black text-gray-900">
                {fearGreed?.current.description ?? "Loading..."}
              </span>
            </div>

            <span className="inline-flex items-center px-3 py-1.5 rounded-full text-xs font-extrabold bg-purple-100 border border-purple-200 text-purple-700">
              {fearGreed?.current.label ?? "Loading"}
            </span>
          </div>
        </article>
      </div>

      <div className="grid" style={{ gridTemplateColumns: "1fr" }}>
        <article className="bg-white border border-gray-200 rounded-2xl shadow-lg p-4 overflow-hidden bg-gradient-to-b from-white to-purple-50">
          <div className="flex items-start justify-between gap-4 mb-4">
            <div className="flex items-start gap-3">
              <div className="w-11 h-11 rounded-xl bg-purple-100 flex items-center justify-center text-purple-600 font-black text-lg flex-shrink-0 shadow-inner">
                ₿
              </div>
              <div>
                <h3 className="text-lg font-semibold tracking-wide text-gray-900 m-0">
                  BTC Key Levels
                </h3>
                <div className="text-sm text-gray-500 mt-1">
                  Major support and resistance zones to watch next
                </div>
              </div>
            </div>
            <span className="inline-flex items-center px-3 py-1.5 rounded-full text-xs font-extrabold bg-purple-100 border border-purple-300 text-purple-700">
              Updated Daily
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <section className="border border-gray-200 rounded-2xl p-4 bg-white shadow-sm bg-gradient-to-b from-white to-red-50">
              <div className="flex items-center justify-between mb-3">
                <div className="text-xs font-extrabold tracking-wider uppercase text-gray-500">
                  Next Resistance
                </div>
                <span className="w-3 h-3 bg-red-600 rounded-full"></span>
              </div>
              <div className="flex items-center justify-between gap-3 py-3 px-3 rounded-xl border border-gray-200 bg-white">
                <strong className="text-lg font-black text-gray-900 tracking-wide">
                  {btcLevels
                    ? fmtUSD(btcLevels.keyLevels.breakoutLevel)
                    : "$72,400"}
                </strong>
                <span className="text-xs font-extrabold text-gray-500 bg-gray-100 px-2 py-1 rounded-full">
                  R1
                </span>
              </div>
            </section>

            <section className="border border-gray-200 rounded-2xl p-4 bg-white shadow-sm bg-gradient-to-b from-white to-green-50">
              <div className="flex items-center justify-between mb-3">
                <div className="text-xs font-extrabold tracking-wider uppercase text-gray-500">
                  Next Support
                </div>
                <span className="w-3 h-3 bg-green-600 rounded-full"></span>
              </div>
              <div className="flex items-center justify-between gap-3 py-3 px-3 rounded-xl border border-gray-200 bg-white">
                <strong className="text-lg font-black text-gray-900 tracking-wide">
                  {btcLevels
                    ? fmtUSD(btcLevels.keyLevels.breakdownLevel)
                    : "$69,200"}
                </strong>
                <span className="text-xs font-extrabold text-gray-500 bg-gray-100 px-2 py-1 rounded-full">
                  S1
                </span>
              </div>
            </section>
          </div>

          <div className="flex justify-between items-center gap-3 mt-4 pt-4 border-t border-gray-200 flex-wrap">
            <div className="flex gap-3 flex-wrap">
              <span className="inline-flex items-center px-3 py-1.5 rounded-full text-xs font-extrabold bg-purple-100 border border-purple-300 text-purple-700">
                Breakout Level:{" "}
                {btcLevels
                  ? fmtUSD(btcLevels.keyLevels.breakoutLevel)
                  : "$72,400"}
              </span>
              <span className="inline-flex items-center px-3 py-1.5 rounded-full text-xs font-extrabold bg-gray-100 border border-gray-300 text-gray-700">
                Breakdown Level:{" "}
                {btcLevels
                  ? fmtUSD(btcLevels.keyLevels.breakdownLevel)
                  : "$69,200"}
              </span>
            </div>
            <div className="text-xs text-gray-500 font-bold">
              Use with structure confirmation, not as standalone entries.
            </div>
          </div>
        </article>
      </div>
    </main>
  );
}
