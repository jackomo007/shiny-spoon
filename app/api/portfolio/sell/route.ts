import { NextResponse } from "next/server"
import { z } from "zod"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { PortfolioRepo } from "@/data/repositories/portfolio.repo"

const Body = z.object({
  symbol: z.string().min(1),
  priceUsd: z.number().positive(),
  amountToSell: z.number().positive(),
  feeUsd: z.number().min(0).default(0),
})

export async function POST(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.accountId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  const accountId = session.accountId

  const data = Body.parse(await req.json())
  const positions = await PortfolioRepo.getPositions(accountId)
  const sym = data.symbol.toUpperCase()
  const have = Number(positions[sym]?.qty ?? 0)
  if (data.amountToSell > have + 1e-8) {
    return NextResponse.json(
      { error: "Insufficient asset amount" },
      { status: 400 }
    )
  }

  await PortfolioRepo.createSpotSellTx({
    accountId,
    symbol: sym,
    priceUsd: data.priceUsd,
    amountToSell: data.amountToSell,
    feeUsd: data.feeUsd ?? 0,
  })

  return NextResponse.json({ ok: true })
}
