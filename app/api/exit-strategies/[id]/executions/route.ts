import { NextResponse } from "next/server"
import { z } from "zod"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { buildExitStrategyDetails } from "@/services/exit-strategy.service"

export const dynamic = "force-dynamic"

const Body = z.object({
  stepGainPercent: z.number().positive(),
  targetPriceUsd: z.number().positive(),
  executedPriceUsd: z.number().positive(),
  quantitySold: z.number().positive(),
})

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params

    const session = await getServerSession(authOptions)
    if (!session?.accountId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const accountId = session.accountId
    const data = Body.parse(await req.json())

    const exists = await prisma.exit_strategy.findFirst({
      where: { id, account_id: accountId },
      select: { id: true },
    })
    if (!exists) return NextResponse.json({ error: "Not found" }, { status: 404 })

    const proceeds = data.quantitySold * data.executedPriceUsd
    const realizedProfit = data.quantitySold * (data.executedPriceUsd - data.targetPriceUsd)

    await prisma.exit_strategy_execution.create({
      data: {
        exit_strategy_id: id,
        step_gain_percent: data.stepGainPercent,
        target_price: data.targetPriceUsd,
        executed_price: data.executedPriceUsd,
        quantity_sold: data.quantitySold,
        proceeds,
        realized_profit: realizedProfit,
      },
      select: { id: true },
    })

    const fresh = await buildExitStrategyDetails(accountId, id)
    return NextResponse.json({ data: fresh }, { status: 201 })
  } catch (err) {
    if (err instanceof z.ZodError) return NextResponse.json({ error: err.flatten() }, { status: 400 })
    console.error("[POST /api/exit-strategies/[id]/executions] error:", err)
    return NextResponse.json({ error: "Internal error" }, { status: 500 })
  }
}
