import { NextResponse } from "next/server"
import { z } from "zod"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { getOpenSpotHolding } from "@/services/portfolio-holdings.service"

export const dynamic = "force-dynamic"

const Body = z.object({
  coinSymbol: z.string().min(1),
  sellPercent: z.number().positive().max(100),
  gainPercent: z.number().positive().max(10_000),
  maxSteps: z.number().int().positive().max(50).optional(),
})

function round(n: number, digits: number): number {
  const p = 10 ** digits
  return Math.round(n * p) / p
}

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.accountId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const accountId = session.accountId
    const body = Body.parse(await req.json())

    const coin = body.coinSymbol.trim().toUpperCase()
    const sellPct = body.sellPercent / 100
    const gainStep = body.gainPercent
    const maxSteps = body.maxSteps ?? 10

    const holding = await getOpenSpotHolding(accountId, coin)
    const qtyOpen = holding?.qty ?? 0
    const entryPriceUsd = holding?.avgEntryPriceUsd ?? 0

    let remaining = qtyOpen
    let cumulative = 0

    const rows: Array<{
      gainPercent: number
      targetPriceUsd: number
      plannedQtyToSell: number
      executedQtyToSell: null
      proceedsUsd: number
      remainingQtyAfter: number
      realizedProfitUsd: number
      cumulativeRealizedProfitUsd: number
      isExecuted: false
    }> = []

    for (let i = 1; i <= maxSteps; i++) {
      const gain = round(gainStep * i, 2)
      const target = entryPriceUsd > 0 ? entryPriceUsd * (1 + gain / 100) : 0

      const qtySoldNow = remaining > 0 ? remaining * sellPct : 0
      const proceeds = qtySoldNow * target
      const profit = qtySoldNow * (target - entryPriceUsd)

      remaining = Math.max(0, remaining - qtySoldNow)
      cumulative += profit

      rows.push({
        gainPercent: gain,
        targetPriceUsd: round(target, 8),
        plannedQtyToSell: round(qtySoldNow, 8),
        executedQtyToSell: null,
        proceedsUsd: round(proceeds, 2),
        remainingQtyAfter: round(remaining, 8),
        realizedProfitUsd: round(profit, 2),
        cumulativeRealizedProfitUsd: round(cumulative, 2),
        isExecuted: false,
      })

      if (remaining <= 0) break
    }

    return NextResponse.json({
      data: {
        coinSymbol: coin,
        qtyOpen: round(qtyOpen, 8),
        entryPriceUsd: round(entryPriceUsd, 8),
        rows,
      },
    })
  } catch (err) {
    if (err instanceof z.ZodError) return NextResponse.json({ error: err.flatten() }, { status: 400 })
    console.error("[POST /api/exit-strategies/simulate] error:", err)
    return NextResponse.json({ error: "Internal error" }, { status: 500 })
  }
}
