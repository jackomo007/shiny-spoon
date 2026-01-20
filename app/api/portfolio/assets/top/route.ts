import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { cgTopByMarketCap } from "@/lib/markets/coingecko"

export const dynamic = "force-dynamic"

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.accountId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const top = await cgTopByMarketCap(6)
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
  })
}
