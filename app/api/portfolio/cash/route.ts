import { NextResponse } from "next/server"
import { z } from "zod"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { PortfolioRepo } from "@/data/repositories/portfolio.repo"

const Body = z.object({
  amountUsd: z.number().nonnegative(),
})

export async function POST(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.accountId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const accountId = session.accountId
  const { amountUsd: targetCash } = Body.parse(await req.json())

  const currentCash = await PortfolioRepo.getCashBalance(accountId)

  if (Math.abs(targetCash - currentCash) < 1e-8) {
    return NextResponse.json({ ok: true })
  }

  let kind: "deposit" | "withdraw"
  let delta: number

  if (targetCash > currentCash) {
    kind = "deposit"
    delta = targetCash - currentCash
  } else {
    kind = "withdraw"
    delta = currentCash - targetCash

    if (delta > currentCash + 1e-8) {
      return NextResponse.json(
        { error: "Insufficient cash balance" },
        { status: 400 },
      )
    }
  }

  await PortfolioRepo.createCashAdjustment({
    accountId,
    amountUsd: delta,
    kind,
    tradeAt: new Date(),
  })

  return NextResponse.json({ ok: true })
}
