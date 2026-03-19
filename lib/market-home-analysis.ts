import "server-only";

import { revalidateTag, unstable_cache } from "next/cache";
import OpenAI from "openai";
import { zodResponseFormat } from "openai/helpers/zod";
import { z } from "zod";
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
    refreshBucket: string;
    source: string;
    method: "ai";
    currentTotalMarketCap: string;
    chartPoints: number;
    basedOn: string[];
    isEstimated?: boolean;
  };
};

const openai = process.env.OPENAI_API_KEY
  ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  : null;
const MARKET_HOME_ANALYSIS_TAG = "market-home-analysis";
const NEW_YORK_TZ = "America/New_York";
const REFRESH_HOURS = [1, 5, 9, 13, 17, 21] as const;

function cleanAnalysisText(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function normalizeSentiment(value: unknown): MarketSentiment | unknown {
  if (typeof value !== "string") return value;

  const normalized = value.trim().toLowerCase();
  if (normalized === "bullish") return "Bullish";
  if (normalized === "bearish") return "Bearish";
  if (normalized === "neutral") return "Neutral";
  return value;
}

const analysisTextSchema = z
  .string()
  .transform(cleanAnalysisText)
  .refine((value) => value.length > 0);

const structuredMarketAnalysisSchema = z.object({
  sentiment: z.preprocess(
    normalizeSentiment,
    z.enum(["Bullish", "Bearish", "Neutral"]),
  ),
  marketTrend: analysisTextSchema,
  phase: analysisTextSchema,
  support: analysisTextSchema,
  resistance: analysisTextSchema,
  structure: analysisTextSchema,
  dashboardSummary: z.object({
    bullishConfirmation: analysisTextSchema,
    neutralRange: analysisTextSchema,
    bearishBreakdown: analysisTextSchema,
  }),
});

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

function getZonedParts(date: Date, timeZone: string) {
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
  const currentDateKey = `${parts.year}-${String(parts.month).padStart(2, "0")}-${String(
    parts.day,
  ).padStart(2, "0")}`;
  const previousDateKey = shiftDateKey(currentDateKey, -1);
  const currentTotalMinutes = parts.hour * 60 + parts.minute;

  const windows = [
    { dateKey: previousDateKey, hour: 21 },
    ...REFRESH_HOURS.map((hour) => ({ dateKey: currentDateKey, hour })),
  ];

  let activeWindow = windows[0];
  for (const window of windows) {
    if (window.dateKey !== currentDateKey) continue;
    if (currentTotalMinutes >= window.hour * 60) {
      activeWindow = window;
    }
  }

  return `${activeWindow.dateKey}-${String(activeWindow.hour).padStart(2, "0")}00`;
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
  now: Date,
): Promise<void> {
  const recordedAt = new Date(now);
  recordedAt.setUTCHours(0, 0, 0, 0);

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

function parseAiPayload(raw: string): StructuredMarketAnalysis | null {
  try {
    const parsed = structuredMarketAnalysisSchema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : null;
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
    const response = await openai.chat.completions.parse({
      model: process.env.MARKET_ANALYSIS_MODEL ?? "gpt-4o-mini",
      temperature: 0.2,
      response_format: zodResponseFormat(
        structuredMarketAnalysisSchema,
        "market_home_analysis",
      ),
      messages: [
        {
          role: "system",
          content:
            "You are a professional crypto market analyst. Use the attached TOTAL market cap chart and provided context. Return only the requested JSON object.",
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

    const message = response.choices[0]?.message;
    if (message?.parsed) {
      return message.parsed;
    }

    const raw = typeof message?.content === "string" ? message.content.trim() : "";
    const parsed = raw ? parseAiPayload(raw) : null;

    if (!parsed) {
      console.error("[market-home-analysis] AI response did not match schema", {
        refusal:
          typeof message === "object" && message && "refusal" in message
            ? (message.refusal ?? null)
            : null,
        rawPreview: raw.slice(0, 1200),
      });
    }

    return parsed;
  } catch (error) {
    console.error("[market-home-analysis] AI generation failed:", error);
    return null;
  }
}

async function generateLiveAnalysis(): Promise<AnalysisResponse> {
  const now = new Date();
  const refreshBucket = getRefreshBucket(now);
  const context = await fetchCurrentMarketContext();

  await persistDailySnapshots(context, now);

  const series = await loadMarketCapSeries(context);
  const ai = await maybeGenerateAiAnalysis(context, series);
  if (!ai) {
    throw new Error("AI market analysis unavailable");
  }
  const generatedAt = new Date().toISOString();

  return {
    analysis: ai,
    meta: {
      generatedAt,
      refreshBucket,
      source: "TOTAL chart snapshots + live market data + OpenAI",
      method: "ai",
      currentTotalMarketCap: context.totalMarketCapFormatted,
      chartPoints: series.length,
      basedOn: [
        "coingecko_global_market_data",
        "alternative_me_fear_greed",
        "daily_total_market_snapshots",
        "generated_on_request",
      ],
    },
  };
}

function getCachedMarketAnalysis(refreshBucket: string) {
  return unstable_cache(
    generateLiveAnalysis,
    ["market-home-analysis", refreshBucket],
    {
      revalidate: false,
      tags: [MARKET_HOME_ANALYSIS_TAG, `${MARKET_HOME_ANALYSIS_TAG}:${refreshBucket}`],
    },
  )();
}

export async function getDailyMarketAnalysis(
  now = new Date(),
): Promise<AnalysisResponse> {
  return getCachedMarketAnalysis(getRefreshBucket(now));
}

export async function warmDailyMarketAnalysis(now = new Date()) {
  revalidateTag(MARKET_HOME_ANALYSIS_TAG);
  return getCachedMarketAnalysis(getRefreshBucket(now));
}
