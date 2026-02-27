import { NextResponse } from "next/server"
import { z } from "zod"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { PortfolioRepoV2 } from "@/data/repositories/portfolio.repo.v2"

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

    await PortfolioRepoV2.createInitTransaction({
      accountId,
      symbol: data.symbol.toUpperCase(),
      qty: data.amount,
      priceUsd: data.priceUsd,
      feeUsd: data.feeUsd,
      executedAt: new Date(data.executedAt),
      notes: "[PORTFOLIO_INIT]",
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
