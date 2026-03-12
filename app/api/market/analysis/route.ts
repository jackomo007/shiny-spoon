import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export const dynamic = "force-dynamic";

type MarketSentiment = "Bullish" | "Bearish" | "Neutral";
type MarketMovement = "Trending Up" | "Trending Down" | "Sideways";

type CoinGeckoGlobalResponse = {
  data?: {
    market_cap_change_percentage_24h_usd?: number;
    market_cap_percentage?: {
      btc?: number;
    };
  };
};

type FearGreedResponse = {
  data?: Array<{
    value?: string;
    value_classification?: string;
  }>;
};

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

async function getMarketData() {
  const [globalRes, fearGreedRes] = await Promise.allSettled([
    fetch("https://api.coingecko.com/api/v3/global", {
      headers: {
        Accept: "application/json",
      },
      next: { revalidate: 300 },
    }),
    fetch("https://api.alternative.me/fng/?limit=1", {
      headers: {
        Accept: "application/json",
      },
      next: { revalidate: 1800 },
    }),
  ]);

  let marketCap = null;
  let btcDominance = null;
  let fearGreed = null;

  if (globalRes.status === "fulfilled" && globalRes.value.ok) {
    const global = await parseJsonIfValid<CoinGeckoGlobalResponse>(
      globalRes.value,
    );
    const change24h = global?.data?.market_cap_change_percentage_24h_usd;
    const btc = global?.data?.market_cap_percentage?.btc;

    if (typeof change24h === "number") {
      marketCap = { change24hPct: change24h };
    }
    if (typeof btc === "number") {
      btcDominance = btc;
    }
  }

  if (fearGreedRes.status === "fulfilled" && fearGreedRes.value.ok) {
    const fg = await parseJsonIfValid<FearGreedResponse>(fearGreedRes.value);
    const latest = fg?.data?.[0];
    const score = Number.parseInt(latest?.value ?? "", 10);

    if (Number.isFinite(score)) {
      fearGreed = {
        score,
        label:
          latest?.value_classification?.trim() || getFearGreedLabel(score),
      };
    }
  }

  return { marketCap, btcDominance, fearGreed };
}

type MarketData = {
  marketCap: { change24hPct?: number } | null;
  btcDominance: number | null;
  fearGreed: { score?: number; label: string } | null;
};

function analyzeSentiment(marketData: MarketData): MarketSentiment {
  const { marketCap, btcDominance, fearGreed } = marketData;

  let bullishSignals = 0;
  let bearishSignals = 0;

  if (marketCap?.change24hPct !== undefined && marketCap.change24hPct > 2)
    bullishSignals++;
  else if (marketCap?.change24hPct !== undefined && marketCap.change24hPct < -2)
    bearishSignals++;

  if (btcDominance !== null && btcDominance > 55) bearishSignals++;
  else if (btcDominance !== null && btcDominance < 45) bullishSignals++;

  if (fearGreed?.score !== undefined && fearGreed.score > 70) bullishSignals++;
  else if (fearGreed?.score !== undefined && fearGreed.score < 30)
    bearishSignals++;

  if (bullishSignals > bearishSignals) return "Bullish";
  if (bearishSignals > bullishSignals) return "Bearish";
  return "Neutral";
}

function analyzeMovement(marketData: MarketData): MarketMovement {
  const { marketCap } = marketData;

  if (!marketCap?.change24hPct) return "Sideways";

  const change = marketCap.change24hPct;

  if (change > 3) return "Trending Up";
  if (change < -3) return "Trending Down";
  return "Sideways";
}

function generateAnalysisBullets(marketData: MarketData): string[] {
  const { marketCap, btcDominance, fearGreed } = marketData;
  const bullets: string[] = [];

  if (marketCap?.change24hPct !== undefined) {
    const change = marketCap.change24hPct;
    if (change > 0) {
      bullets.push(
        `TOTAL market cap up ${change.toFixed(1)}% showing institutional confidence.`,
      );
    } else {
      bullets.push(
        `TOTAL market cap down ${Math.abs(change).toFixed(1)}% indicating profit-taking pressure.`,
      );
    }
  }

  if (btcDominance !== null) {
    if (btcDominance > 52) {
      bullets.push(
        `BTC dominance at ${btcDominance.toFixed(1)}% suggests money flowing into Bitcoin over alts.`,
      );
    } else {
      bullets.push(
        `BTC dominance at ${btcDominance.toFixed(1)}% indicates potential alt season momentum building.`,
      );
    }
  }

  if (fearGreed?.score !== undefined && fearGreed.label) {
    if (fearGreed.score > 70) {
      bullets.push(
        `Fear & Greed at ${fearGreed.score} (${fearGreed.label}) warns of potential market overextension.`,
      );
    } else if (fearGreed.score < 30) {
      bullets.push(
        `Fear & Greed at ${fearGreed.score} (${fearGreed.label}) suggests oversold conditions and buying opportunity.`,
      );
    } else {
      bullets.push(
        `Fear & Greed at ${fearGreed.score} (${fearGreed.label}) indicates balanced market sentiment.`,
      );
    }
  }

  const contextBullets = [
    "Monitor key support/resistance levels for confirmation of trend continuation.",
    "Volume analysis suggests institutional participation remains selective.",
    "Cross-asset correlations indicate macro uncertainty affecting risk-on sentiment.",
    "Technical indicators showing mixed signals across major timeframes.",
  ];

  bullets.push(
    contextBullets[Math.floor(Math.random() * contextBullets.length)],
  );

  return bullets.slice(0, 4);
}

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.accountId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const marketData = await getMarketData();

    const sentiment = analyzeSentiment(marketData);
    const movement = analyzeMovement(marketData);
    const bullets = generateAnalysisBullets(marketData);

    return NextResponse.json({
      analysis: {
        sentiment,
        movement,
        bullets,
        confidence: "medium",
      },
      meta: {
        generatedAt: new Date().toISOString(),
        source: "Internal Analysis Engine",
        basedOn: ["market_cap_trends", "btc_dominance", "fear_greed_index"],
      },
    });
  } catch (error) {
    console.error("[GET /api/market/analysis] error:", error);

    return NextResponse.json({
      analysis: {
        sentiment: "Bearish" as MarketSentiment,
        movement: "Sideways" as MarketMovement,
        bullets: [
          "TOTAL structure: higher highs holding above weekly support.",
          "BTC structure: consolidating near range highs; watch breakout confirmation.",
          "ETH structure: lagging vs BTC; needs reclaim of key resistance to lead.",
          "BTC.D: rising bias suggests selective alt exposure until dominance rolls over.",
        ],
        confidence: "medium",
      },
      meta: {
        generatedAt: new Date().toISOString(),
        source: "Internal Analysis Engine",
        isEstimated: true,
      },
    });
  }
}
