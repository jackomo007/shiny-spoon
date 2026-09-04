import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { cgTopByMarketCap } from "@/lib/markets/coingecko";

export const dynamic = "force-dynamic";

const FALLBACK_TOP_ASSETS = [
  { id: "bitcoin", symbol: "BTC", name: "Bitcoin" },
  { id: "ethereum", symbol: "ETH", name: "Ethereum" },
  { id: "tether", symbol: "USDT", name: "Tether" },
  { id: "usd-coin", symbol: "USDC", name: "USDC" },
  { id: "solana", symbol: "SOL", name: "Solana" },
  { id: "binancecoin", symbol: "BNB", name: "BNB" },
];

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.accountId)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const top = await cgTopByMarketCap(6);
    return NextResponse.json({
      items: top.map((c) => ({
        id: c.id,
        symbol: c.symbol?.toUpperCase(),
        name: c.name,
        image: c.image ?? null,
        priceUsd: c.current_price ?? null,
        change24hPct: c.price_change_percentage_24h ?? null,
        marketCapRank: c.market_cap_rank ?? null,
      })),
    });
  } catch {
    return NextResponse.json({
      items: FALLBACK_TOP_ASSETS.map((asset, index) => ({
        ...asset,
        image: null,
        priceUsd: asset.symbol === "USDT" || asset.symbol === "USDC" ? 1 : null,
        change24hPct: null,
        marketCapRank: index + 1,
      })),
    });
  }
}
