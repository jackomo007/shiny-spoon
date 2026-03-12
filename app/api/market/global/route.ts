import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export const dynamic = "force-dynamic";

type CoinGeckoGlobalResponse = {
  data: {
    total_market_cap: {
      usd: number;
    };
    total_volume: {
      usd: number;
    };
    market_cap_percentage: {
      btc: number;
      eth: number;
    };
    market_cap_change_percentage_24h_usd: number;
  };
};

async function fetchGlobalData(): Promise<{
  totalMarketCapUsd: number;
  btcDominance: number;
  ethDominance: number;
  marketCapChange24h: number;
  totalVolumeUsd: number;
}> {
  const url = "https://api.coingecko.com/api/v3/global";

  const res = await fetch(url, {
    headers: {
      Accept: "application/json",
    },
    next: { revalidate: 300 },
  });

  if (!res.ok) {
    throw new Error(`CoinGecko API error: ${res.status}`);
  }

  const data: CoinGeckoGlobalResponse = await res.json();

  return {
    totalMarketCapUsd: data.data.total_market_cap.usd,
    btcDominance: data.data.market_cap_percentage.btc,
    ethDominance: data.data.market_cap_percentage.eth,
    marketCapChange24h: data.data.market_cap_change_percentage_24h_usd,
    totalVolumeUsd: data.data.total_volume.usd,
  };
}

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.accountId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const globalData = await fetchGlobalData();

    return NextResponse.json({
      totalMarketCap: {
        usd: globalData.totalMarketCapUsd,
        change24hPct: globalData.marketCapChange24h,
        formatted: `$${(globalData.totalMarketCapUsd / 1_000_000_000_000).toFixed(2)}T`,
      },
      dominance: {
        btc: globalData.btcDominance,
        eth: globalData.ethDominance,
      },
      volume24h: {
        usd: globalData.totalVolumeUsd,
      },
      updatedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error("[GET /api/market/global] error:", error);

    return NextResponse.json({
      totalMarketCap: {
        usd: 2170000000000,
        change24hPct: 0.9,
        formatted: "$2.17T",
      },
      dominance: {
        btc: 52.1,
        eth: 17.8,
      },
      volume24h: {
        usd: 65000000000,
      },
      updatedAt: new Date().toISOString(),
      isEstimated: true,
    });
  }
}
