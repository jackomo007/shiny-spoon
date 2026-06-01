import "server-only";

import { revalidateTag, unstable_cache } from "next/cache";
import OpenAI from "openai";
import { zodResponseFormat } from "openai/helpers/zod";
import { z } from "zod";
import {
  generateMarketCapChartPng,
  type MarketCapChartPoint,
} from "@/lib/market-home-chart";

export type MarketTrend = "Bullish" | "Bearish" | "Range Bound";
export type ThermometerTone =
  | "undervalued"
  | "discounted"
  | "fair"
  | "overextended"
  | "euphoric";
export type StakkSignal = "Accumulate" | "Scale-Out";

type CoinGeckoGlobalResponse = {
  data?: {
    market_cap_percentage?: {
      btc?: number;
    };
  };
};

type CoinGeckoPriceResponse = {
  bitcoin?: {
    usd?: number;
    usd_24h_change?: number;
  };
};

type CoinGeckoMarketChartResponse = {
  prices?: Array<[number, number]>;
};

type BinanceTickerResponse = {
  price?: string;
};

type BinanceKline = [
  number,
  string,
  string,
  string,
  string,
  string,
  number,
  string,
  number,
  string,
  string,
  string,
];

type FearGreedResponse = {
  data?: Array<{
    value?: string;
    value_classification?: string;
  }>;
};

type AiBitcoinAnalysis = {
  marketTrend: MarketTrend;
  bullishZone: {
    low: number;
    high: number;
  };
  bearishZone: {
    low: number;
    high: number;
  };
};

type PriceZone = AiBitcoinAnalysis["bullishZone"];

export type BitcoinContext = {
  btcPriceUsd: number;
  btcChange24hPct: number;
  btcDominance: number | null;
  twoHundredWeekMa: number;
  distanceFromMaPct: number;
  fearGreedScore: number | null;
  fearGreedLabel: string | null;
};

export type StructuredMarketAnalysis = AiBitcoinAnalysis & {
  thermometer: {
    label: string;
    tone: ThermometerTone;
    movingAverage: string;
    distance: string;
    marketTrendCopy: string;
    stakkInsight: string;
    signal: StakkSignal;
  };
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
    currentBtcPrice: string;
    chartPoints: number;
    basedOn: string[];
  };
};

const openai = process.env.OPENAI_API_KEY
  ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  : null;

const MARKET_HOME_ANALYSIS_TAG = "market-home-analysis";
const NEW_YORK_TZ = "America/New_York";
const REFRESH_HOURS = [1, 5, 9, 13, 17, 21] as const;
const TWO_HUNDRED_WEEKS = 200;

function coinGeckoHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    Accept: "application/json",
    "User-Agent": "stakk-ai-local-dev",
  };

  if (process.env.COINGECKO_API_KEY) {
    headers["x-cg-pro-api-key"] = process.env.COINGECKO_API_KEY;
  }

  return headers;
}

function coinGeckoBaseUrl(): string {
  return process.env.COINGECKO_PRO === "true"
    ? "https://pro-api.coingecko.com/api/v3"
    : "https://api.coingecko.com/api/v3";
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function coinGeckoFetch(url: string): Promise<Response> {
  const tries = 3;

  for (let attempt = 0; attempt < tries; attempt++) {
    const res = await fetch(url, {
      headers: coinGeckoHeaders(),
      cache: "no-store",
    });

    if (res.ok) return res;

    if (res.status === 429 || (res.status >= 500 && res.status <= 599)) {
      await sleep(250 * 2 ** attempt);
      continue;
    }

    return res;
  }

  return fetch(url, {
    headers: coinGeckoHeaders(),
    cache: "no-store",
  });
}

async function binanceFetch(url: string): Promise<Response> {
  const tries = 3;

  for (let attempt = 0; attempt < tries; attempt++) {
    const res = await fetch(url, { cache: "no-store" });
    if (res.ok) return res;

    if (res.status === 429 || (res.status >= 500 && res.status <= 599)) {
      await sleep(250 * 2 ** attempt);
      continue;
    }

    return res;
  }

  return fetch(url, { cache: "no-store" });
}

function normalizeTrend(value: unknown): MarketTrend | unknown {
  if (typeof value !== "string") return value;

  const normalized = value.trim().toLowerCase();
  if (normalized === "bullish") return "Bullish";
  if (normalized === "bearish") return "Bearish";
  if (
    normalized === "range bound" ||
    normalized === "range-bound" ||
    normalized === "neutral"
  ) {
    return "Range Bound";
  }

  return value;
}

const priceZoneSchema = z.object({
  low: z.coerce.number().finite(),
  high: z.coerce.number().finite(),
});

const aiBitcoinAnalysisSchema = z.object({
  marketTrend: z.preprocess(
    normalizeTrend,
    z.enum(["Bullish", "Bearish", "Range Bound"]),
  ),
  bullishZone: priceZoneSchema,
  bearishZone: priceZoneSchema,
});

function formatUsd(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return "$0";

  return value.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });
}

function formatRange(zone: { low: number; high: number }): string {
  const low = Math.min(zone.low, zone.high);
  const high = Math.max(zone.low, zone.high);
  return `${formatUsd(low)} - ${formatUsd(high)}`;
}

function normalizeAiPriceLevel(
  value: number,
  currentPrice: number,
): number | null {
  if (!Number.isFinite(value) || value <= 0) return null;

  let normalized = value;
  if (currentPrice >= 10_000 && value < 1_000) {
    normalized = value * 1_000;
  }

  const minReasonable = currentPrice * 0.45;
  const maxReasonable = currentPrice * 1.6;

  if (normalized < minReasonable || normalized > maxReasonable) {
    return null;
  }

  return normalized;
}

function normalizeAiZone(
  zone: PriceZone,
  currentPrice: number,
): PriceZone | null {
  const low = normalizeAiPriceLevel(zone.low, currentPrice);
  const high = normalizeAiPriceLevel(zone.high, currentPrice);

  if (low === null || high === null) return null;

  return {
    low: Math.min(low, high),
    high: Math.max(low, high),
  };
}

function deriveTechnicalZones(currentPrice: number): {
  bullishZone: PriceZone;
  bearishZone: PriceZone;
} {
  const baseLevel = Math.round(currentPrice / 1_000) * 1_000;
  const bullishLow = Math.max(baseLevel + 1_000, currentPrice + 500);
  const bearishHigh = Math.min(baseLevel - 1_000, currentPrice - 500);

  return {
    bullishZone: {
      low: Math.round(bullishLow),
      high: Math.round(bullishLow + 2_000),
    },
    bearishZone: {
      low: Math.round(bearishHigh - 2_000),
      high: Math.round(bearishHigh),
    },
  };
}

function sanitizeAiAnalysis(
  ai: AiBitcoinAnalysis,
  context: BitcoinContext,
): AiBitcoinAnalysis {
  const currentPrice = context.btcPriceUsd;
  const fallback = deriveTechnicalZones(currentPrice);
  const bullishZone = normalizeAiZone(ai.bullishZone, currentPrice);
  const bearishZone = normalizeAiZone(ai.bearishZone, currentPrice);
  const bullishIsUsable =
    bullishZone !== null &&
    bullishZone.high > currentPrice &&
    bullishZone.low >= currentPrice * 0.95;
  const bearishIsUsable =
    bearishZone !== null &&
    bearishZone.low < currentPrice &&
    bearishZone.high <= currentPrice * 1.05;

  return {
    ...ai,
    bullishZone: bullishIsUsable ? bullishZone : fallback.bullishZone,
    bearishZone: bearishIsUsable ? bearishZone : fallback.bearishZone,
  };
}

function getUtcWeekKey(timestamp: number): string {
  const date = new Date(timestamp);
  const day = date.getUTCDay();
  const mondayOffset = day === 0 ? -6 : 1 - day;
  const monday = new Date(
    Date.UTC(
      date.getUTCFullYear(),
      date.getUTCMonth(),
      date.getUTCDate() + mondayOffset,
    ),
  );

  return monday.toISOString().slice(0, 10);
}

function getWeeklyCloses(points: MarketCapChartPoint[]): MarketCapChartPoint[] {
  const weekly = new Map<string, MarketCapChartPoint>();

  for (const point of points) {
    weekly.set(getUtcWeekKey(point.timestamp), point);
  }

  return [...weekly.values()].sort((a, b) => a.timestamp - b.timestamp);
}

function parseJsonIfValid<T>(response: Response): Promise<T | null> {
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.toLowerCase().includes("application/json")) {
    return Promise.resolve(null);
  }

  return response.json().catch(() => null) as Promise<T | null>;
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

async function fetchCurrentBitcoinContext(): Promise<{
  context: BitcoinContext;
  series: MarketCapChartPoint[];
}> {
  const cgBase = coinGeckoBaseUrl();
  const [
    priceRes,
    chartRes,
    fallbackChartRes,
    binanceTickerRes,
    binanceWeeklyRes,
    globalRes,
    fearGreedRes,
  ] = await Promise.allSettled([
    coinGeckoFetch(
      `${cgBase}/simple/price?ids=bitcoin&vs_currencies=usd&include_24hr_change=true`,
    ),
    coinGeckoFetch(
      `${cgBase}/coins/bitcoin/market_chart?vs_currency=usd&days=1500&interval=daily`,
    ),
    coinGeckoFetch(
      `${cgBase}/coins/bitcoin/market_chart?vs_currency=usd&days=max`,
    ),
    binanceFetch("https://api.binance.com/api/v3/ticker/price?symbol=BTCUSDT"),
    binanceFetch(
      "https://api.binance.com/api/v3/klines?symbol=BTCUSDT&interval=1w&limit=200",
    ),
    coinGeckoFetch(`${cgBase}/global`),
    fetch("https://api.alternative.me/fng/?limit=1", {
      headers: { Accept: "application/json" },
      cache: "no-store",
    }),
  ]);

  const price =
    priceRes.status === "fulfilled" && priceRes.value.ok
      ? await parseJsonIfValid<CoinGeckoPriceResponse>(priceRes.value)
      : null;
  const chart =
    chartRes.status === "fulfilled" && chartRes.value.ok
      ? await parseJsonIfValid<CoinGeckoMarketChartResponse>(chartRes.value)
      : null;
  const fallbackChart =
    fallbackChartRes.status === "fulfilled" && fallbackChartRes.value.ok
      ? await parseJsonIfValid<CoinGeckoMarketChartResponse>(
          fallbackChartRes.value,
        )
      : null;
  const binanceTicker =
    binanceTickerRes.status === "fulfilled" && binanceTickerRes.value.ok
      ? await parseJsonIfValid<BinanceTickerResponse>(binanceTickerRes.value)
      : null;
  const binanceWeekly =
    binanceWeeklyRes.status === "fulfilled" && binanceWeeklyRes.value.ok
      ? await parseJsonIfValid<BinanceKline[]>(binanceWeeklyRes.value)
      : null;

  const toPricePoints = (data: CoinGeckoMarketChartResponse | null) =>
    data?.prices
      ?.filter(
        (point): point is [number, number] =>
          Array.isArray(point) &&
          Number.isFinite(point[0]) &&
          Number.isFinite(point[1]) &&
          point[1] > 0,
      )
      .map(([timestamp, value]) => ({ timestamp, value })) ?? [];

  const chartPrices = toPricePoints(chart);
  const fallbackPrices = toPricePoints(fallbackChart);
  const binanceWeeklyPrices =
    binanceWeekly
      ?.filter(
        (point): point is BinanceKline =>
          Array.isArray(point) &&
          Number.isFinite(point[0]) &&
          Number.isFinite(Number(point[4])) &&
          Number(point[4]) > 0,
      )
      .map((point) => ({
        timestamp: point[0],
        value: Number(point[4]),
      })) ?? [];
  const coinGeckoPrices =
    fallbackPrices.length > chartPrices.length ? fallbackPrices : chartPrices;
  const rawPrices =
    coinGeckoPrices.length > 0 ? coinGeckoPrices : binanceWeeklyPrices;

  const latestChartPrice = rawPrices.at(-1)?.value;
  const previousChartPrice = rawPrices.at(-2)?.value;
  const binancePrice = Number(binanceTicker?.price);
  const btcPriceUsd =
    Number.isFinite(price?.bitcoin?.usd) && price?.bitcoin?.usd
      ? price.bitcoin.usd
      : Number.isFinite(binancePrice) && binancePrice > 0
        ? binancePrice
        : latestChartPrice;

  if (!Number.isFinite(btcPriceUsd) || !btcPriceUsd || btcPriceUsd <= 0) {
    throw new Error("Bitcoin price unavailable");
  }

  const weeklyCloses = getWeeklyCloses(rawPrices);
  if (weeklyCloses.length < TWO_HUNDRED_WEEKS) {
    throw new Error(
      `Bitcoin 200W moving average history unavailable (${weeklyCloses.length} weekly points received)`,
    );
  }

  const maWindow = weeklyCloses.slice(-TWO_HUNDRED_WEEKS);
  const twoHundredWeekMa =
    maWindow.reduce((sum, point) => sum + point.value, 0) / maWindow.length;
  const distanceFromMaPct =
    ((btcPriceUsd - twoHundredWeekMa) / twoHundredWeekMa) * 100;

  let btcDominance: number | null = null;
  if (globalRes.status === "fulfilled" && globalRes.value.ok) {
    const global = await parseJsonIfValid<CoinGeckoGlobalResponse>(
      globalRes.value,
    );
    if (typeof global?.data?.market_cap_percentage?.btc === "number") {
      btcDominance = global.data.market_cap_percentage.btc;
    }
  }

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
      fearGreedLabel = latest?.value_classification?.trim() || null;
    }
  }

  return {
    context: {
      btcPriceUsd,
      btcChange24hPct:
        typeof price?.bitcoin?.usd_24h_change === "number"
          ? price.bitcoin.usd_24h_change
          : previousChartPrice && previousChartPrice > 0
            ? ((btcPriceUsd - previousChartPrice) / previousChartPrice) * 100
            : 0,
      btcDominance,
      twoHundredWeekMa,
      distanceFromMaPct,
      fearGreedScore,
      fearGreedLabel,
    },
    series: rawPrices.slice(-30),
  };
}

function getThermometer(distancePct: number): {
  label: string;
  tone: ThermometerTone;
  marketTrendCopy: string;
  stakkInsight: string;
  signal: StakkSignal;
} {
  if (distancePct >= 200) {
    return {
      label: "Euphoric",
      tone: "euphoric",
      marketTrendCopy:
        "Bitcoin is trading extremely far above its 200W MA, placing price in the Euphoric zone relative to historical cycle trends. Historically, this level of extension has occurred during peak market euphoria, where momentum and speculation accelerate rapidly before major cycle tops and periods of heightened volatility.",
      stakkInsight:
        "We suggest aggressively scaling out positions, systematically locking in profits, and avoiding emotional late-cycle buying behavior.",
      signal: "Scale-Out",
    };
  }

  if (distancePct >= 80) {
    return {
      label: "Overvalued",
      tone: "overextended",
      marketTrendCopy:
        "Bitcoin is trading significantly above its 200W MA, placing price in the Overvalued zone based on historical cycle behavior. Historically, moves this far above the long-term trend have signaled increasing market optimism and elevated speculative activity, often occurring during the later stages of bullish expansions.",
      stakkInsight:
        "We suggest reducing aggressive buying behavior and beginning gradual scale-outs into strength to protect gains and reduce cycle risk.",
      signal: "Scale-Out",
    };
  }

  if (distancePct >= 20) {
    return {
      label: "Fair Value",
      tone: "fair",
      marketTrendCopy:
        "Bitcoin is trading moderately above its 200W MA, placing price in the Fair Value zone relative to historical cycle positioning. This range has historically represented balanced market conditions where Bitcoin remains in a healthy long-term uptrend without showing signs of major overextension.",
      stakkInsight:
        "We suggest consistently DCA'ing while maintaining balanced exposure and avoiding emotional over-positioning.",
      signal: "Accumulate",
    };
  }

  if (distancePct >= 0) {
    return {
      label: "Discounted Value",
      tone: "discounted",
      marketTrendCopy:
        "Bitcoin is trading slightly above its 200W MA, placing price in the Discounted Value zone based on historical distance from the long-term cycle trend. Historically, this area has represented a deep value accumulation zone where long-term investors have aggressively accumulated Bitcoin.",
      stakkInsight:
        "We suggest continuing to DCA into Bitcoin, but less aggressively than in deeply undervalued conditions.",
      signal: "Accumulate",
    };
  }

  return {
    label: "Undervalued",
    tone: "undervalued",
    marketTrendCopy:
      "Bitcoin is trading below its 200W MA, placing price in the Undervalued zone relative to its long-term cycle trend. Historically, periods below the 200W MA have occurred during deep bear market conditions and have represented some of the strongest long-term accumulation opportunities for patient investors.",
    stakkInsight:
      "We suggest aggressively DCA'ing into Bitcoin during this zone, as historically this has been one of the highest long-term value areas of the cycle.",
    signal: "Accumulate",
  };
}

function parseAiPayload(raw: string): AiBitcoinAnalysis | null {
  try {
    const parsed = aiBitcoinAnalysisSchema.safeParse(JSON.parse(raw));
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
  context: BitcoinContext,
  series: MarketCapChartPoint[],
): Promise<AiBitcoinAnalysis | null> {
  if (!openai) return null;

  const image = await generateMarketCapChartPng(series, {
    title: "Bitcoin Daily Price",
    subtitle: "Recent BTC price action used for Home Page AI analysis",
    latestLabel: "Current BTC price",
    valueFormatter: formatUsd,
  });
  const imageDataUrl = toDataUrl(image);

  const prompt = [
    `Analyze the BITCOIN chart. Current Price: ${formatUsd(context.btcPriceUsd)}.`,
    "Return the response in JSON format:",
    "{",
    '  "marketTrend": "(only 3 options, Bearish, Range Bound or Bullish on the daily)",',
    '  "bullishZone": {',
    '    "low": 74000,',
    '    "high": 76000',
    "  },",
    '  "bearishZone": {',
    '    "low": 71000,',
    '    "high": 73000',
    "  }",
    "}",
    "",
    "Extra context:",
    `- BTC 24h change: ${context.btcChange24hPct.toFixed(2)}%`,
    `- BTC dominance: ${
      context.btcDominance === null
        ? "unavailable"
        : `${context.btcDominance.toFixed(2)}%`
    }`,
    `- 200W moving average: ${formatUsd(context.twoHundredWeekMa)}`,
    `- Distance from 200W MA: ${context.distanceFromMaPct.toFixed(2)}%`,
    `- Fear & Greed: ${
      context.fearGreedScore !== null && context.fearGreedLabel
        ? `${context.fearGreedScore} (${context.fearGreedLabel})`
        : "unavailable"
    }`,
    "",
    "Rules:",
    "- Use the attached BTC daily chart first, then the context above.",
    "- marketTrend must be exactly Bullish, Range Bound, or Bearish.",
    "- bullishZone and bearishZone must be full numeric USD prices, not strings or abbreviated values.",
    "- Never return 0 for any price level.",
    "- Return only valid JSON.",
  ].join("\n");

  try {
    const response = await openai.chat.completions.parse({
      model: process.env.MARKET_ANALYSIS_MODEL ?? "gpt-4o-mini",
      temperature: 0.2,
      response_format: zodResponseFormat(
        aiBitcoinAnalysisSchema,
        "bitcoin_home_analysis",
      ),
      messages: [
        {
          role: "system",
          content:
            "You are a professional Bitcoin market analyst. Use the attached BTC chart and provided context. Return only the requested JSON object.",
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

    const raw =
      typeof message?.content === "string" ? message.content.trim() : "";
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

function enrichAnalysis(
  ai: AiBitcoinAnalysis,
  context: BitcoinContext,
): StructuredMarketAnalysis {
  const normalizedAi = sanitizeAiAnalysis(ai, context);
  const thermometer = getThermometer(context.distanceFromMaPct);
  const nearestLow = Math.min(
    normalizedAi.bearishZone.low,
    normalizedAi.bullishZone.low,
  );
  const nearestHigh = Math.max(
    normalizedAi.bearishZone.high,
    normalizedAi.bullishZone.high,
  );

  return {
    ...normalizedAi,
    bullishZone: {
      low: Math.min(
        normalizedAi.bullishZone.low,
        normalizedAi.bullishZone.high,
      ),
      high: Math.max(
        normalizedAi.bullishZone.low,
        normalizedAi.bullishZone.high,
      ),
    },
    bearishZone: {
      low: Math.min(
        normalizedAi.bearishZone.low,
        normalizedAi.bearishZone.high,
      ),
      high: Math.max(
        normalizedAi.bearishZone.low,
        normalizedAi.bearishZone.high,
      ),
    },
    thermometer: {
      ...thermometer,
      movingAverage: formatUsd(context.twoHundredWeekMa),
      distance: `${context.distanceFromMaPct >= 0 ? "+" : ""}${context.distanceFromMaPct.toFixed(1)}%`,
    },
    dashboardSummary: {
      bullishConfirmation: formatRange(normalizedAi.bullishZone),
      neutralRange: formatRange({ low: nearestLow, high: nearestHigh }),
      bearishBreakdown: formatRange(normalizedAi.bearishZone),
    },
  };
}

async function generateLiveAnalysis(): Promise<AnalysisResponse> {
  const now = new Date();
  const refreshBucket = getRefreshBucket(now);
  const { context, series } = await fetchCurrentBitcoinContext();
  const ai = await maybeGenerateAiAnalysis(context, series);

  if (!ai) {
    throw new Error("AI Bitcoin analysis unavailable");
  }

  const generatedAt = new Date().toISOString();

  return {
    analysis: enrichAnalysis(ai, context),
    meta: {
      generatedAt,
      refreshBucket,
      source: "Bitcoin daily chart + live market data + OpenAI",
      method: "ai",
      currentBtcPrice: formatUsd(context.btcPriceUsd),
      chartPoints: series.length,
      basedOn: [
        "coingecko_bitcoin_price",
        "coingecko_bitcoin_daily_chart",
        "bitcoin_200w_moving_average",
        "alternative_me_fear_greed",
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
      tags: [
        MARKET_HOME_ANALYSIS_TAG,
        `${MARKET_HOME_ANALYSIS_TAG}:${refreshBucket}`,
      ],
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
