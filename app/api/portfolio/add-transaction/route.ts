import { NextResponse } from "next/server"
import { z } from "zod"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { PortfolioRepoV2 } from "@/data/repositories/portfolio.repo.v2"
import { cgPriceUsdById } from "@/lib/markets/coingecko"

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

    const symbol = input.asset.symbol.toUpperCase()
    const executedAt = input.executedAt ? new Date(input.executedAt) : new Date()

    let priceUsd: number
    if (input.priceMode === "market") {
      const m = await cgPriceUsdById(input.asset.id)
      priceUsd = m.priceUsd
    } else {
      if (!input.priceUsd) return NextResponse.json({ error: "Missing custom priceUsd" }, { status: 400 })
      priceUsd = input.priceUsd
    }

    let qty = input.qty ?? null
    let totalUsd = input.totalUsd ?? null

    if (qty == null && totalUsd == null) {
      return NextResponse.json({ error: "Provide qty or totalUsd" }, { status: 400 })
    }

    if (qty == null && totalUsd != null) qty = totalUsd / priceUsd
    if (totalUsd == null && qty != null) totalUsd = qty * priceUsd

    if (!qty || !Number.isFinite(qty) || qty <= 0) return NextResponse.json({ error: "Invalid qty" }, { status: 400 })

    await PortfolioRepoV2.createSpotTransaction({
      accountId: session.accountId,
      symbol,
      side: input.side,
      qty,
      priceUsd,
      feeUsd: input.feeUsd ?? 0,
      executedAt,
      notes: `[PORTFOLIO_SPOT_TX] cg:${input.asset.id}`,
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
