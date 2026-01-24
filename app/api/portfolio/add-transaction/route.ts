import { NextResponse } from "next/server"
import { z } from "zod"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { PortfolioRepoV2 } from "@/data/repositories/portfolio.repo.v2"
import { prisma } from "@/lib/prisma"
import {
  cgNormalizeOrResolveCoinId,
  cgPriceUsdById,
  cgCoinMetaByIdSafe,
} from "@/lib/markets/coingecko"

export const dynamic = "force-dynamic"

const Body = z.object({
  asset: z.object({
    id: z.string().min(1),
    symbol: z.string().min(1),
    name: z.string().optional().nullable(),
  }),
  side: z.enum(["buy", "sell"]).default("buy"),
  priceMode: z.enum(["market", "custom"]).default("market"),
  priceUsd: z.number().positive().optional(),
  qty: z.number().positive().optional(),
  totalUsd: z.number().positive().optional(),
  feeUsd: z.number().min(0).optional(),
  executedAt: z.string().datetime().optional(),
})

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.accountId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const input = Body.parse(await req.json())

    const symbol = input.asset.symbol.trim().toUpperCase()
    const executedAt = input.executedAt ? new Date(input.executedAt) : new Date()

    const coingeckoId = await cgNormalizeOrResolveCoinId({
      assetId: input.asset.id,
      assetSymbol: symbol,
    })

    let priceUsd: number
    let change24hPct: number | null = null

    if (input.priceMode === "market") {
      if (!coingeckoId) {
        return NextResponse.json(
          { error: `Could not resolve CoinGecko id for ${symbol}.` },
          { status: 400 }
        )
      }
      const m = await cgPriceUsdById(coingeckoId)
      priceUsd = m.priceUsd
      change24hPct = m.change24hPct
    } else {
      if (input.priceUsd == null) {
        return NextResponse.json({ error: "Missing custom priceUsd" }, { status: 400 })
      }
      priceUsd = input.priceUsd
    }

    let qty = input.qty ?? null
    let totalUsd = input.totalUsd ?? null

    if (qty == null && totalUsd == null) {
      return NextResponse.json({ error: "Provide qty or totalUsd" }, { status: 400 })
    }
    if (qty == null && totalUsd != null) qty = totalUsd / priceUsd
    if (totalUsd == null && qty != null) totalUsd = qty * priceUsd

    if (!qty || !Number.isFinite(qty) || qty <= 0) {
      return NextResponse.json({ error: "Invalid qty" }, { status: 400 })
    }

    let imageUrl: string | null = null
    let name: string | null =
      (input.asset.name ?? null) && String(input.asset.name).trim()
        ? String(input.asset.name).trim()
        : null

    if (coingeckoId) {
      const meta = await cgCoinMetaByIdSafe(coingeckoId)
      if (meta.ok) {
        imageUrl = meta.imageUrl
        if (!name) name = meta.name || null
      }
    }

    await prisma.verified_asset.upsert({
      where: { symbol },
      update: {
        name,
        coingecko_id: coingeckoId,
        image_url: imageUrl,
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

    await PortfolioRepoV2.createSpotTransaction({
      accountId: session.accountId,
      symbol,
      side: input.side,
      qty,
      priceUsd,
      feeUsd: input.feeUsd ?? 0,
      executedAt,
      notes: `[PORTFOLIO_SPOT_TX] cg:${coingeckoId ?? "unresolved"} chg24h:${change24hPct ?? "n/a"}`,
    })

    return NextResponse.json({ ok: true })
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.flatten() }, { status: 400 })
    }
    console.error("[POST /api/portfolio/add-transaction] error:", err)
    return NextResponse.json({ error: "Internal error" }, { status: 500 })
  }
}
