import { NextResponse } from "next/server"
import { z } from "zod"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { PortfolioRepo } from "@/data/repositories/portfolio.repo"

const Body = z.object({
  symbol: z.string().min(1),
  priceUsd: z.number().positive(),
  cashToSpend: z.number().positive(),
  feeUsd: z.number().min(0).default(0),
})

export async function POST(req: Request) {
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
  })

  return NextResponse.json({ ok: true })
}
