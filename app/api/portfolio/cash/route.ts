import { NextResponse } from "next/server"
import { z } from "zod"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { PortfolioRepo } from "@/data/repositories/portfolio.repo"

const Body = z.object({
  amountUsd: z.number().positive(),
  kind: z.enum(["deposit", "withdraw"]),
})

export async function POST(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.accountId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  const accountId = session.accountId
  const data = Body.parse(await req.json())

  if (data.kind === "withdraw") {
    const cash = await PortfolioRepo.getCashBalance(accountId)
    if (data.amountUsd > cash + 1e-8) {
      return NextResponse.json(
        { error: "Insufficient cash balance" },
        { status: 400 }
      )
    }
  }

  await PortfolioRepo.createCashAdjustment({
    accountId,
    amountUsd: data.amountUsd,
    kind: data.kind,
    tradeAt: new Date(),
  })

  return NextResponse.json({ ok: true })
}
