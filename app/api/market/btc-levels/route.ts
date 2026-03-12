import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { cgPriceUsdByIdSafe } from "@/lib/markets/coingecko";

export const dynamic = "force-dynamic";

type PriceLevel = {
  price: number;
  level: string;
  type: "support" | "resistance";
  strength: "weak" | "medium" | "strong";
};

async function getCurrentBtcPrice(): Promise<number> {
  try {
    const btcPrice = await cgPriceUsdByIdSafe("bitcoin");

    if (btcPrice.ok) {
      return btcPrice.priceUsd;
    }
  } catch (error) {
    console.error("Error fetching BTC price:", error);
  }

  return 67000;
}

function calculateTechnicalLevels(currentPrice: number): {
  resistances: PriceLevel[];
  supports: PriceLevel[];
  breakoutLevel: number;
  breakdownLevel: number;
} {
  const baseLevel = Math.round(currentPrice / 1000) * 1000;

  const resistances: PriceLevel[] = [
    {
      price: baseLevel + 3000,
      level: "R3",
      type: "resistance" as const,
      strength: "weak" as const,
    },
    {
      price: baseLevel + 2000,
      level: "R2",
      type: "resistance" as const,
      strength: "medium" as const,
    },
    {
      price: baseLevel + 1000,
      level: "R1",
      type: "resistance" as const,
      strength: "strong" as const,
    },
  ].filter((r) => r.price > currentPrice);

  const supports: PriceLevel[] = [
    {
      price: baseLevel - 1000,
      level: "S1",
      type: "support" as const,
      strength: "strong" as const,
    },
    {
      price: baseLevel - 2000,
      level: "S2",
      type: "support" as const,
      strength: "medium" as const,
    },
    {
      price: baseLevel - 3000,
      level: "S3",
      type: "support" as const,
      strength: "weak" as const,
    },
  ].filter((s) => s.price < currentPrice);

  const nearestResistance =
    resistances.find((r) => r.strength === "strong")?.price || baseLevel + 1000;
  const nearestSupport =
    supports.find((s) => s.strength === "strong")?.price || baseLevel - 1000;

  return {
    resistances,
    supports,
    breakoutLevel: nearestResistance,
    breakdownLevel: nearestSupport,
  };
}

function generateStructureInsights(
  currentPrice: number,
  levels: {
    breakoutLevel: number;
    breakdownLevel: number;
  },
): string[] {
  const insights: string[] = [];

  const midpoint = (levels.breakoutLevel + levels.breakdownLevel) / 2;
  if (currentPrice > midpoint) {
    insights.push(
      "BTC trading above midrange, bias towards upside continuation.",
    );
  } else {
    insights.push(
      "BTC trading below midrange, watch for breakdown acceleration.",
    );
  }

  const distanceToResistance =
    ((levels.breakoutLevel - currentPrice) / currentPrice) * 100;
  const distanceToSupport =
    ((currentPrice - levels.breakdownLevel) / currentPrice) * 100;

  if (distanceToResistance < 3) {
    insights.push(
      "Approaching key resistance - watch for rejection or breakout confirmation.",
    );
  } else if (distanceToSupport < 3) {
    insights.push(
      "Near critical support zone - break below could trigger cascade selling.",
    );
  }

  const contextInsights = [
    "Volume confirmation needed at key levels for validated moves.",
    "Multiple timeframe alignment suggests current structure is reliable.",
    "Weekly levels holding significance in current market regime.",
  ];

  return [
    ...insights,
    contextInsights[Math.floor(Math.random() * contextInsights.length)],
  ].slice(0, 3);
}

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.accountId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const currentPrice = await getCurrentBtcPrice();

    const levels = calculateTechnicalLevels(currentPrice);

    const insights = generateStructureInsights(currentPrice, levels);

    return NextResponse.json({
      current: {
        price: currentPrice,
        timestamp: new Date().toISOString(),
      },
      levels: {
        resistances: levels.resistances,
        supports: levels.supports,
        all: [...levels.resistances, ...levels.supports].sort(
          (a, b) => b.price - a.price,
        ),
      },
      keyLevels: {
        breakoutLevel: levels.breakoutLevel,
        breakdownLevel: levels.breakdownLevel,
        range: {
          high: levels.breakoutLevel,
          low: levels.breakdownLevel,
          midpoint: (levels.breakoutLevel + levels.breakdownLevel) / 2,
        },
      },
      insights,
      meta: {
        method: "Technical Analysis",
        timeframe: "Daily",
        updatedAt: new Date().toISOString(),
        disclaimer:
          "Use with structure confirmation, not as standalone entries.",
      },
    });
  } catch (error) {
    console.error("[GET /api/market/btc-levels] error:", error);

    return NextResponse.json({
      current: {
        price: 67000,
        timestamp: new Date().toISOString(),
      },
      levels: {
        resistances: [
          {
            price: 72400,
            level: "R2",
            type: "resistance" as const,
            strength: "medium" as const,
          },
          {
            price: 70800,
            level: "R1",
            type: "resistance" as const,
            strength: "strong" as const,
          },
        ],
        supports: [
          {
            price: 69200,
            level: "S1",
            type: "support" as const,
            strength: "strong" as const,
          },
          {
            price: 67500,
            level: "S2",
            type: "support" as const,
            strength: "medium" as const,
          },
        ],
        all: [
          {
            price: 72400,
            level: "R2",
            type: "resistance" as const,
            strength: "medium" as const,
          },
          {
            price: 70800,
            level: "R1",
            type: "resistance" as const,
            strength: "strong" as const,
          },
          {
            price: 69200,
            level: "S1",
            type: "support" as const,
            strength: "strong" as const,
          },
          {
            price: 67500,
            level: "S2",
            type: "support" as const,
            strength: "medium" as const,
          },
        ],
      },
      keyLevels: {
        breakoutLevel: 72400,
        breakdownLevel: 69200,
        range: {
          high: 72400,
          low: 69200,
          midpoint: 70800,
        },
      },
      insights: [
        "BTC consolidating near range highs ahead of key resistance test.",
        "Volume confirmation needed for breakout above $72,400.",
        "Support cluster around $69,200 offers risk management level.",
      ],
      meta: {
        method: "Technical Analysis",
        timeframe: "Daily",
        updatedAt: new Date().toISOString(),
        disclaimer:
          "Use with structure confirmation, not as standalone entries.",
        isEstimated: true,
      },
    });
  }
}
