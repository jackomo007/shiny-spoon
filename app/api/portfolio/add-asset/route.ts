import { NextResponse } from "next/server"
import { z } from "zod"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { PortfolioRepo } from "@/data/repositories/portfolio.repo"

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

    await PortfolioRepo.createInitPosition({
      accountId,
      symbol: data.symbol.toUpperCase(),
      amount: data.amount,
      priceUsd: data.priceUsd,
      feeUsd: data.feeUsd,
      strategyId: data.strategyId ?? null,
      tradeAt: new Date(data.executedAt),
    })

    return NextResponse.json({ ok: true })
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.flatten() }, { status: 400 })
    }
    console.error("[POST /api/portfolio/add-asset] error:", err)
    return NextResponse.json({ error: "Internal error" }, { status: 500 })
  }
}
