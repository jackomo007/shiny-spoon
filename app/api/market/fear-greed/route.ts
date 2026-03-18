import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export const dynamic = "force-dynamic";

type FearGreedResponse = {
  name: string;
  data: Array<{
    value: string;
    value_classification: string;
    timestamp: string;
    time_until_update?: string;
  }>;
  metadata: {
    error?: string;
  };
};

function getFearGreedLabel(score: number): string {
  if (score <= 24) return "Extreme Fear";
  if (score <= 44) return "Fear";
  if (score <= 55) return "Neutral";
  if (score <= 74) return "Greed";
  return "Extreme Greed";
}

function getFearGreedColor(score: number): string {
  if (score <= 24) return "red";
  if (score <= 44) return "orange";
  if (score <= 55) return "yellow";
  if (score <= 74) return "green";
  return "green";
}

function getFearGreedDescription(score: number): string {
  if (score <= 24) {
    return "Fear is dominant. Traders are highly defensive, which usually lines up with stressed or capitulation-like conditions.";
  }
  if (score <= 44) {
    return "Sentiment is cautious. Traders remain defensive, and confidence stays weak until price strength improves.";
  }
  if (score <= 55) {
    return "Market sentiment is balanced. Traders are split between caution and optimism, which usually fits range-bound conditions.";
  }
  if (score <= 74) {
    return "Greed is starting to lead sentiment. Traders are leaning risk-on, but strong follow-through is still needed to confirm expansion.";
  }
  return "Sentiment is overheated. Traders are aggressively risk-on, which can support momentum but also raises the chance of short-term excess.";
}

async function fetchFearGreedIndex(): Promise<{
  score: number;
  label: string;
  color: string;
  timestamp: string;
  change7d: number | null;
}> {
  const url = "https://api.alternative.me/fng/?limit=8";

  const res = await fetch(url, {
    headers: {
      Accept: "application/json",
    },
    next: { revalidate: 3600 },
  });

  if (!res.ok) {
    throw new Error(`Fear & Greed API error: ${res.status}`);
  }

  const data: FearGreedResponse = await res.json();

  if (data.metadata.error) {
    throw new Error(`Fear & Greed API error: ${data.metadata.error}`);
  }

  const latest = data.data[0];
  const latestScore = Number.parseInt(latest.value, 10);
  const sevenDaysAgo = data.data[7];
  const sevenDaysAgoScore = sevenDaysAgo
    ? Number.parseInt(sevenDaysAgo.value, 10)
    : Number.NaN;

  return {
    score: latestScore,
    label: latest.value_classification?.trim() || getFearGreedLabel(latestScore),
    color: getFearGreedColor(latestScore),
    timestamp: latest.timestamp,
    change7d: Number.isFinite(sevenDaysAgoScore)
      ? latestScore - sevenDaysAgoScore
      : null,
  };
}

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.accountId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const fearGreed = await fetchFearGreedIndex();

    return NextResponse.json({
      current: {
        score: fearGreed.score,
        label: fearGreed.label,
        color: fearGreed.color,
        description: `${fearGreed.score} — ${fearGreed.label}`,
        narrative: getFearGreedDescription(fearGreed.score),
      },
      history: {
        change7d: fearGreed.change7d,
      },
      meta: {
        source: "Alternative.me Fear & Greed Index",
        updatedAt: new Date().toISOString(),
        timestamp: fearGreed.timestamp,
      },
    });
  } catch (error) {
    console.error("[GET /api/market/fear-greed] error:", error);
    return NextResponse.json(
      { error: "Failed to load Fear & Greed data" },
      { status: 503 },
    );
  }
}
