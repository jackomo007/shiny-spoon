import { NextResponse } from "next/server"
import { z } from "zod"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { PortfolioRepo } from "@/data/repositories/portfolio.repo"

export const dynamic = "force-dynamic"

const Body = z.object({
  symbol: z.string().min(1),
  priceUsd: z.number().positive(),
  cashToSpend: z.number().positive(),
  feeUsd: z.number().min(0).default(0),
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

    const cash = await PortfolioRepo.getCashBalance(accountId)
    const required = data.cashToSpend + (data.feeUsd ?? 0)
    if (required > cash + 1e-8) {
      return NextResponse.json(
        { error: "Insufficient cash balance" },
        { status: 400 }
      )
    }

    await PortfolioRepo.createSpotBuyTx({
      accountId,
      symbol: data.symbol.toUpperCase(),
      priceUsd: data.priceUsd,
      cashToSpend: data.cashToSpend,
      feeUsd: data.feeUsd ?? 0,
      strategyId: data.strategyId ?? null,
      tradeAt: new Date(data.executedAt),
    })

    return NextResponse.json({ ok: true })
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.flatten() }, { status: 400 })
    }
    console.error("[POST /api/portfolio/buy] error:", err)
    return NextResponse.json({ error: "Internal error" }, { status: 500 })
  }
}
