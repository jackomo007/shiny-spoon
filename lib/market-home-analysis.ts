import "server-only";

import { unstable_cache } from "next/cache";
import OpenAI from "openai";
import { prisma } from "@/lib/prisma";
import {
  generateMarketCapChartPng,
  type MarketCapChartPoint,
} from "@/lib/market-home-chart";

export type MarketSentiment = "Bullish" | "Bearish" | "Neutral";

type CoinGeckoGlobalResponse = {
  data?: {
    total_market_cap?: {
      usd?: number;
    };
    total_volume?: {
      usd?: number;
    };
    market_cap_percentage?: {
      btc?: number;
      eth?: number;
      usdt?: number;
    };
    market_cap_change_percentage_24h_usd?: number;
  };
};

type FearGreedResponse = {
  data?: Array<{
    value?: string;
    value_classification?: string;
  }>;
};

export type MarketContext = {
  totalMarketCapUsd: number;
  totalMarketCapFormatted: string;
  marketCapChange24hPct: number;
  btcDominance: number;
  ethDominance: number;
  usdtDominance: number;
  totalVolumeUsd: number;
  fearGreedScore: number | null;
  fearGreedLabel: string | null;
};

export type StructuredMarketAnalysis = {
  sentiment: MarketSentiment;
  marketTrend: string;
  phase: string;
  support: string;
  resistance: string;
  structure: string;
  keyTakeaway: string;
  dashboardSummary: {
    bullishConfirmation: string;
    neutralRange: string;
    bearishBreakdown: string;
  };
};

export type AnalysisResponse = {
  analysis: StructuredMarketAnalysis;
  meta: {
    generatedAt: string;
    scheduledRefresh: string;
    scheduleTimezone: string;
    refreshBucket: string;
    source: string;
    method: "ai" | "heuristic";
    currentTotalMarketCap: string;
    chartPoints: number;
    basedOn: string[];
    isEstimated?: boolean;
  };
};

const NEW_YORK_TZ = "America/New_York";
const REFRESH_HOUR = 9;
const openai = process.env.OPENAI_API_KEY
  ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  : null;

function formatCapUsd(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return "$0";

  if (value >= 1_000_000_000_000) {
    return `$${(value / 1_000_000_000_000).toFixed(2)}T`;
  }

  if (value >= 1_000_000_000) {
    return `$${(value / 1_000_000_000).toFixed(0)}B`;
  }

  return value.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });
}

function formatRangeUsd(min: number, max: number): string {
  return `${formatCapUsd(min)} - ${formatCapUsd(max)}`;
}

function getFearGreedLabel(score: number): string {
  if (score <= 24) return "Extreme Fear";
  if (score <= 44) return "Fear";
  if (score <= 55) return "Neutral";
  if (score <= 74) return "Greed";
  return "Extreme Greed";
}

async function parseJsonIfValid<T>(response: Response): Promise<T | null> {
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.toLowerCase().includes("application/json")) {
    return null;
  }

  try {
    return (await response.json()) as T;
  } catch {
    return null;
  }
}

export function getZonedParts(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(date);

  const map = Object.fromEntries(
    parts
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, part.value]),
  );

  return {
    year: Number(map.year),
    month: Number(map.month),
    day: Number(map.day),
    hour: Number(map.hour),
    minute: Number(map.minute),
    second: Number(map.second),
  };
}

function shiftDateKey(dateKey: string, days: number): string {
  const [year, month, day] = dateKey.split("-").map(Number);
  const dt = new Date(Date.UTC(year, month - 1, day));
  dt.setUTCDate(dt.getUTCDate() + days);
  return dt.toISOString().slice(0, 10);
}

export function getRefreshBucket(now = new Date()): string {
  const parts = getZonedParts(now, NEW_YORK_TZ);
  const dateKey = `${parts.year}-${String(parts.month).padStart(2, "0")}-${String(
    parts.day,
  ).padStart(2, "0")}`;
  const afterRefresh =
    parts.hour > REFRESH_HOUR ||
    (parts.hour === REFRESH_HOUR &&
      (parts.minute > 0 || parts.second >= 0));

  return afterRefresh ? dateKey : shiftDateKey(dateKey, -1);
}

export function getNextRefreshLabel(now = new Date()): string {
  const parts = getZonedParts(now, NEW_YORK_TZ);
  const dateKey = `${parts.year}-${String(parts.month).padStart(2, "0")}-${String(
    parts.day,
  ).padStart(2, "0")}`;
  const afterRefresh =
    parts.hour > REFRESH_HOUR ||
    (parts.hour === REFRESH_HOUR &&
      (parts.minute > 0 || parts.second >= 0));
  const nextDate = afterRefresh ? shiftDateKey(dateKey, 1) : dateKey;
  return `${nextDate} 09:00 ET`;
}

export function isScheduledRefreshWindow(now = new Date()) {
  const parts = getZonedParts(now, NEW_YORK_TZ);
  return parts.hour === REFRESH_HOUR;
}

async function fetchCurrentMarketContext(): Promise<MarketContext> {
  const [globalRes, fearGreedRes] = await Promise.allSettled([
    fetch("https://api.coingecko.com/api/v3/global", {
      headers: { Accept: "application/json" },
      cache: "no-store",
    }),
    fetch("https://api.alternative.me/fng/?limit=1", {
      headers: { Accept: "application/json" },
      cache: "no-store",
    }),
  ]);

  if (globalRes.status !== "fulfilled" || !globalRes.value.ok) {
    throw new Error("Global market data unavailable");
  }

  const global = await parseJsonIfValid<CoinGeckoGlobalResponse>(globalRes.value);
  const totalMarketCapUsd = global?.data?.total_market_cap?.usd;

  if (!Number.isFinite(totalMarketCapUsd) || !totalMarketCapUsd || totalMarketCapUsd <= 0) {
    throw new Error("Global market cap missing from CoinGecko response");
  }

  const marketCapChange24hPct =
    typeof global?.data?.market_cap_change_percentage_24h_usd === "number"
      ? global.data.market_cap_change_percentage_24h_usd
      : 0;
  const btcDominance =
    typeof global?.data?.market_cap_percentage?.btc === "number"
      ? global.data.market_cap_percentage.btc
      : 0;
  const ethDominance =
    typeof global?.data?.market_cap_percentage?.eth === "number"
      ? global.data.market_cap_percentage.eth
      : 0;
  const usdtDominance =
    typeof global?.data?.market_cap_percentage?.usdt === "number"
      ? global.data.market_cap_percentage.usdt
      : 0;
  const totalVolumeUsd =
    typeof global?.data?.total_volume?.usd === "number"
      ? global.data.total_volume.usd
      : 0;

  let fearGreedScore: number | null = null;
  let fearGreedLabel: string | null = null;

  if (fearGreedRes.status === "fulfilled" && fearGreedRes.value.ok) {
    const fearGreed = await parseJsonIfValid<FearGreedResponse>(
      fearGreedRes.value,
    );
    const latest = fearGreed?.data?.[0];
    const parsedScore = Number.parseInt(latest?.value ?? "", 10);

    if (Number.isFinite(parsedScore)) {
      fearGreedScore = parsedScore;
      fearGreedLabel =
        latest?.value_classification?.trim() || getFearGreedLabel(parsedScore);
    }
  }

  return {
    totalMarketCapUsd,
    totalMarketCapFormatted: formatCapUsd(totalMarketCapUsd),
    marketCapChange24hPct,
    btcDominance,
    ethDominance,
    usdtDominance,
    totalVolumeUsd,
    fearGreedScore,
    fearGreedLabel,
  };
}

async function persistDailySnapshots(
  context: MarketContext,
  refreshBucket: string,
): Promise<void> {
  const recordedAt = new Date(`${refreshBucket}T00:00:00.000Z`);

  const [existingMarket, existingFearGreed] = await Promise.all([
    prisma.global_crypto_market_snapshot.findFirst({
      where: { recorded_at: recordedAt },
      select: { id: true },
    }),
    prisma.fear_greed_index.findFirst({
      where: { recorded_at: recordedAt },
      select: { id: true },
    }),
  ]);

  if (!existingMarket) {
    await prisma.global_crypto_market_snapshot.create({
      data: {
        market_cap_usd: context.totalMarketCapUsd,
        btc_dominance: context.btcDominance,
        usdt_dominance: context.usdtDominance,
        recorded_at: recordedAt,
      },
      select: { id: true },
    });
  }

  if (!existingFearGreed) {
    if (
      context.fearGreedScore !== null &&
      context.fearGreedLabel
    ) {
      await prisma.fear_greed_index.create({
        data: {
          score: context.fearGreedScore,
          value_text: context.fearGreedLabel,
          recorded_at: recordedAt,
        },
        select: { id: true },
      });
    }
  }
}

async function loadMarketCapSeries(
  context: MarketContext,
): Promise<MarketCapChartPoint[]> {
  const rows = await prisma.global_crypto_market_snapshot.findMany({
    orderBy: { recorded_at: "desc" },
    take: 29,
    select: {
      recorded_at: true,
      market_cap_usd: true,
    },
  });

  const ordered = rows.reverse().map((row) => ({
    timestamp: row.recorded_at.getTime(),
    value: Number(row.market_cap_usd),
  }));

  const todayStart = new Date();
  todayStart.setUTCHours(0, 0, 0, 0);
  const hasToday = ordered.some((point) => point.timestamp >= todayStart.getTime());

  if (!hasToday) {
    ordered.push({
      timestamp: Date.now(),
      value: context.totalMarketCapUsd,
    });
  }

  if (ordered.length < 2) {
    const ratio = 1 + context.marketCapChange24hPct / 100;
    const previousValue =
      Number.isFinite(ratio) && ratio > 0
        ? context.totalMarketCapUsd / ratio
        : context.totalMarketCapUsd;

    return [
      {
        timestamp: Date.now() - 86_400_000,
        value: previousValue,
      },
      {
        timestamp: Date.now(),
        value: context.totalMarketCapUsd,
      },
    ];
  }

  return ordered.slice(-30);
}

function buildLevels(context: MarketContext, phase: string) {
  const total = context.totalMarketCapUsd;

  const profile =
    phase === "Expansion"
      ? {
          supportLow: 0.975,
          supportHigh: 0.99,
          resistanceLow: 1.025,
          resistanceHigh: 1.05,
        }
      : phase === "Recovery"
        ? {
            supportLow: 0.97,
            supportHigh: 0.985,
            resistanceLow: 1.02,
            resistanceHigh: 1.045,
          }
        : phase === "Distribution"
          ? {
              supportLow: 0.955,
              supportHigh: 0.975,
              resistanceLow: 1.01,
              resistanceHigh: 1.03,
            }
          : phase === "Retest"
            ? {
                supportLow: 0.96,
                supportHigh: 0.98,
                resistanceLow: 1.01,
                resistanceHigh: 1.035,
              }
            : {
                supportLow: 0.965,
                supportHigh: 0.985,
                resistanceLow: 1.015,
                resistanceHigh: 1.04,
              };

  const supportLow = total * profile.supportLow;
  const supportHigh = total * profile.supportHigh;
  const resistanceLow = total * profile.resistanceLow;
  const resistanceHigh = total * profile.resistanceHigh;

  return {
    supportLow,
    supportHigh,
    resistanceLow,
    resistanceHigh,
    support: formatRangeUsd(supportLow, supportHigh),
    resistance: formatRangeUsd(resistanceLow, resistanceHigh),
  };
}

function analyzeSentiment(context: MarketContext): MarketSentiment {
  let bullishSignals = 0;
  let bearishSignals = 0;

  if (context.marketCapChange24hPct >= 2) bullishSignals += 1;
  if (context.marketCapChange24hPct <= -2) bearishSignals += 1;

  if (context.fearGreedScore !== null && context.fearGreedScore >= 65) {
    bullishSignals += 1;
  }
  if (context.fearGreedScore !== null && context.fearGreedScore <= 35) {
    bearishSignals += 1;
  }

  if (context.btcDominance <= 50) bullishSignals += 1;
  if (context.btcDominance >= 55) bearishSignals += 1;

  if (bullishSignals > bearishSignals) return "Bullish";
  if (bearishSignals > bullishSignals) return "Bearish";
  return "Neutral";
}

function determinePhase(context: MarketContext, sentiment: MarketSentiment) {
  const absChange = Math.abs(context.marketCapChange24hPct);

  if (sentiment === "Bullish" && absChange >= 2.5) return "Expansion";
  if (sentiment === "Bullish") return "Recovery";
  if (sentiment === "Bearish" && absChange >= 2.5) return "Distribution";
  if (sentiment === "Bearish") return "Retest";
  return "Consolidation";
}

function determineStructure(
  context: MarketContext,
  sentiment: MarketSentiment,
  phase: string,
) {
  if (sentiment === "Bullish" && context.btcDominance < 52) {
    return "Broadening participation";
  }
  if (sentiment === "Bullish") {
    return "Higher-lows recovery";
  }
  if (sentiment === "Bearish" && phase === "Distribution") {
    return "Breakdown risk";
  }
  if (sentiment === "Bearish") {
    return "Weak bounce";
  }
  return "Range-bound";
}

function buildHeuristicAnalysis(context: MarketContext): StructuredMarketAnalysis {
  const sentiment = analyzeSentiment(context);
  const phase = determinePhase(context, sentiment);
  const structure = determineStructure(context, sentiment, phase);
  const levels = buildLevels(context, phase);
  const direction =
    context.marketCapChange24hPct > 0
      ? "holding a positive daily expansion"
      : context.marketCapChange24hPct < 0
        ? "absorbing a negative daily move"
        : "holding flat versus the prior session";

  const headline =
    sentiment === "Bullish"
      ? "Bullish"
      : sentiment === "Bearish"
        ? "Bearish"
        : "Neutral";

  const fearGreedSummary =
    context.fearGreedScore !== null && context.fearGreedLabel
      ? `Fear & Greed is ${context.fearGreedScore} (${context.fearGreedLabel})`
      : "Fear & Greed is unavailable";

  const marketTrend = `${headline} — TOTAL is trading around ${context.totalMarketCapFormatted} and ${direction}. BTC dominance sits at ${context.btcDominance.toFixed(
    1,
  )}% while ${fearGreedSummary}, keeping the market in a ${phase.toLowerCase()} profile.`;

  const keyTakeaway =
    sentiment === "Bullish"
      ? `Bullish continuation improves if TOTAL reclaims ${formatCapUsd(levels.resistanceLow)} with BTC dominance staying contained.`
      : sentiment === "Bearish"
        ? `Sellers stay in control if TOTAL loses ${formatCapUsd(levels.supportLow)} and risk appetite keeps fading.`
        : `TOTAL remains range-bound until price leaves the ${formatRangeUsd(levels.supportHigh, levels.resistanceLow)} area with conviction.`;

  const neutralRange = formatRangeUsd(levels.supportLow, levels.resistanceLow);

  return {
    sentiment,
    marketTrend,
    phase,
    support: levels.support,
    resistance: levels.resistance,
    structure,
    keyTakeaway,
    dashboardSummary: {
      bullishConfirmation: `Break above ${formatCapUsd(levels.resistanceLow)}`,
      neutralRange,
      bearishBreakdown: `Below ${formatCapUsd(levels.supportLow)}`,
    },
  };
}

function parseAiPayload(raw: string): StructuredMarketAnalysis | null {
  try {
    const parsed = JSON.parse(raw) as Partial<StructuredMarketAnalysis>;

    if (
      parsed.sentiment !== "Bullish" &&
      parsed.sentiment !== "Bearish" &&
      parsed.sentiment !== "Neutral"
    ) {
      return null;
    }

    if (
      !parsed.marketTrend ||
      !parsed.phase ||
      !parsed.support ||
      !parsed.resistance ||
      !parsed.structure ||
      !parsed.dashboardSummary?.bullishConfirmation ||
      !parsed.dashboardSummary?.neutralRange ||
      !parsed.dashboardSummary?.bearishBreakdown
    ) {
      return null;
    }

    return {
      sentiment: parsed.sentiment,
      marketTrend: parsed.marketTrend,
      phase: parsed.phase,
      support: parsed.support,
      resistance: parsed.resistance,
      structure: parsed.structure,
      keyTakeaway: parsed.keyTakeaway ?? "",
      dashboardSummary: {
        bullishConfirmation: parsed.dashboardSummary.bullishConfirmation,
        neutralRange: parsed.dashboardSummary.neutralRange,
        bearishBreakdown: parsed.dashboardSummary.bearishBreakdown,
      },
    };
  } catch {
    const match = raw.match(/\{[\s\S]*\}/);
    return match ? parseAiPayload(match[0]) : null;
  }
}

function toDataUrl(png: Buffer) {
  return `data:image/png;base64,${png.toString("base64")}`;
}

async function maybeGenerateAiAnalysis(
  context: MarketContext,
  series: MarketCapChartPoint[],
): Promise<StructuredMarketAnalysis | null> {
  if (!openai) return null;

  const image = await generateMarketCapChartPng(series);
  const imageDataUrl = toDataUrl(image);

  const prompt = [
    `Analyze the TOTAL crypto market cap chart. Current TOTAL: ${context.totalMarketCapFormatted}`,
    "Return the response in JSON format:",
    "{",
    '  "sentiment": "",',
    '  "marketTrend": "",',
    '  "phase": "",',
    '  "support": "",',
    '  "resistance": "",',
    '  "structure": "",',
    '  "keyTakeaway": "",',
    '  "dashboardSummary": {',
    '    "bullishConfirmation": "",',
    '    "neutralRange": "",',
    '    "bearishBreakdown": ""',
    "  }",
    "}",
    "",
    "Extra context:",
    `- Total market cap 24h change: ${context.marketCapChange24hPct.toFixed(2)}%`,
    `- BTC dominance: ${context.btcDominance.toFixed(2)}%`,
    `- ETH dominance: ${context.ethDominance.toFixed(2)}%`,
    `- Total volume 24h: ${formatCapUsd(context.totalVolumeUsd)}`,
    `- Fear & Greed: ${
      context.fearGreedScore !== null && context.fearGreedLabel
        ? `${context.fearGreedScore} (${context.fearGreedLabel})`
        : "unavailable"
    }`,
    `- Chart points available: ${series.length}`,
    "",
    "Rules:",
    "- Use the chart first, then the context above.",
    "- Be conservative if the chart history is limited.",
    "- support and resistance should be concise USD ranges or levels.",
    "- structure should be a short label.",
    "- Return only valid JSON.",
  ].join("\n");

  try {
    const response = await openai.chat.completions.create({
      model: process.env.MARKET_ANALYSIS_MODEL ?? "gpt-4o-mini",
      temperature: 0.2,
      messages: [
        {
          role: "system",
          content:
            "You are a professional crypto market analyst. Use the attached TOTAL market cap chart and provided context. Return JSON only.",
        },
        {
          role: "user",
          content: [
            { type: "text", text: prompt },
            { type: "image_url", image_url: { url: imageDataUrl } },
          ],
        },
      ],
    });

    const raw = response.choices[0]?.message?.content?.trim() ?? "";
    return parseAiPayload(raw);
  } catch (error) {
    console.error("[market-home-analysis] AI generation failed:", error);
    return null;
  }
}

async function generateDailyAnalysis(): Promise<AnalysisResponse> {
  const now = new Date();
  const refreshBucket = getRefreshBucket(now);
  const context = await fetchCurrentMarketContext();

  await persistDailySnapshots(context, refreshBucket);

  const series = await loadMarketCapSeries(context);
  const heuristic = buildHeuristicAnalysis(context);
  const ai = await maybeGenerateAiAnalysis(context, series);
  const generatedAt = new Date().toISOString();

  return {
    analysis: ai ?? heuristic,
    meta: {
      generatedAt,
      scheduledRefresh: getNextRefreshLabel(new Date(generatedAt)),
      scheduleTimezone: NEW_YORK_TZ,
      refreshBucket,
      source: ai
        ? "TOTAL chart snapshots + live market data + OpenAI"
        : "TOTAL chart snapshots + live market data",
      method: ai ? "ai" : "heuristic",
      currentTotalMarketCap: context.totalMarketCapFormatted,
      chartPoints: series.length,
      basedOn: [
        "coingecko_global_market_data",
        "alternative_me_fear_greed",
        "daily_total_market_snapshots",
        "scheduled_refresh_09_00_america_new_york",
      ],
    },
  };
}

function getCachedAnalysis(refreshBucket: string) {
  return unstable_cache(generateDailyAnalysis, ["market-analysis", refreshBucket], {
    revalidate: false,
    tags: ["market-home-analysis", `market-home-analysis:${refreshBucket}`],
  })();
}

export async function getDailyMarketAnalysis(
  now = new Date(),
): Promise<AnalysisResponse> {
  return getCachedAnalysis(getRefreshBucket(now));
}

export async function warmDailyMarketAnalysis(now = new Date()) {
  return getCachedAnalysis(getRefreshBucket(now));
}
