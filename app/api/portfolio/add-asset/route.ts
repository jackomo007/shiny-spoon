import { NextResponse } from "next/server"
import { z } from "zod"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { PortfolioRepo } from "@/data/repositories/portfolio.repo"

const Body = z.object({
  symbol: z.string().min(1),
  amount: z.number().positive(),
  priceUsd: z.number().positive(),
  feeUsd: z.number().min(0).optional(),
})

export async function POST(req: Request) {
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
  })
  return NextResponse.json({ ok: true })
}
