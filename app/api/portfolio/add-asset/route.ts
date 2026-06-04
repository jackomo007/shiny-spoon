import { NextResponse } from "next/server"
import { z } from "zod"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { PortfolioRepoV2 } from "@/data/repositories/portfolio.repo.v2"
import { getOpenSpotHolding } from "@/services/portfolio-holdings.service"
import { ensureDefaultExitStrategyForAsset } from "@/services/exit-strategy.service"
import { prisma } from "@/lib/prisma"
import {
  cgCoinMetaByIdSafe,
  cgNormalizeOrResolveCoinId,
} from "@/lib/markets/coingecko"

export const dynamic = "force-dynamic"

const Body = z.object({
  symbol: z.string().min(1),
  amount: z.number().positive(),
  priceUsd: z.number().positive(),
  feeUsd: z.number().min(0).optional(),
  strategyId: z.string().min(1).optional(),
  executedAt: z.string().datetime(), 
})

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.accountId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    const accountId = session.accountId
    const data = Body.parse(await req.json())
    const symbol = data.symbol.toUpperCase()
    const existingHolding = await getOpenSpotHolding(accountId, symbol)

    let coingeckoId: string | null = null
    let name: string | null = null
    let imageUrl: string | null = null

    try {
      coingeckoId = await cgNormalizeOrResolveCoinId({
        assetId: symbol,
        assetSymbol: symbol,
      })

      if (coingeckoId) {
        const meta = await cgCoinMetaByIdSafe(coingeckoId)
        if (meta.ok) {
          name = meta.name || null
          imageUrl = meta.imageUrl
        }
      }
    } catch (error) {
      console.warn("[POST /api/portfolio/add-asset] metadata lookup failed:", error)
    }

    await prisma.verified_asset.upsert({
      where: { symbol },
      update: {
        name: name ?? undefined,
        coingecko_id: coingeckoId ?? undefined,
        image_url: imageUrl ?? undefined,
      },
      create: {
        symbol,
        name,
        exchange: "Binance",
        coingecko_id: coingeckoId,
        image_url: imageUrl,
      },
      select: { id: true },
    })

    await PortfolioRepoV2.createInitTransaction({
      accountId,
      symbol,
      qty: data.amount,
      priceUsd: data.priceUsd,
      feeUsd: data.feeUsd,
      executedAt: new Date(data.executedAt),
      notes: "[PORTFOLIO_INIT]",
    })

    if (!existingHolding) {
      await ensureDefaultExitStrategyForAsset(accountId, symbol)
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.flatten() }, { status: 400 })
    }
    console.error("[POST /api/portfolio/add-asset] error:", err)
    return NextResponse.json({ error: "Internal error" }, { status: 500 })
  }
}
