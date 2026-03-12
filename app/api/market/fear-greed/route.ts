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

async function fetchFearGreedIndex(): Promise<{
  score: number;
  label: string;
  color: string;
  timestamp: string;
}> {
  const url = "https://api.alternative.me/fng/?limit=1";

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
  const score = parseInt(latest.value, 10);

  return {
    score,
    label: getFearGreedLabel(score),
    color: getFearGreedColor(score),
    timestamp: latest.timestamp,
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
      },
      history: {
        change7d: null,
      },
      meta: {
        source: "Alternative.me Fear & Greed Index",
        updatedAt: new Date().toISOString(),
        timestamp: fearGreed.timestamp,
      },
    });
  } catch (error) {
    console.error("[GET /api/market/fear-greed] error:", error);

    return NextResponse.json({
      current: {
        score: 68,
        label: "Greed",
        color: "green",
        description: "68 — Greed",
      },
      history: {
        change7d: -4,
      },
      meta: {
        source: "Alternative.me Fear & Greed Index",
        updatedAt: new Date().toISOString(),
        timestamp: new Date().toISOString(),
        isEstimated: true,
      },
    });
  }
}
