import { NextResponse } from "next/server"
import { z } from "zod"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { PortfolioRepoV2 } from "@/data/repositories/portfolio.repo.v2"
import { getOpenSpotHolding } from "@/services/portfolio-holdings.service"

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
      await prisma.exit_strategy
        .create({
          data: {
            account_id: accountId,
            coin_symbol: symbol,
            is_all_coins: false,
            strategy_type: "percentage",
            sell_percent: 25,
            gain_percent: 30,
            is_active: true,
          },
        })
        .catch((err: unknown) => {
          if (
            typeof err === "object" &&
            err !== null &&
            "code" in err &&
            err.code === "P2002"
          ) {
            return null
          }
          throw err
        })
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
