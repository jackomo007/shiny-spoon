import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { PortfolioRepo } from "@/data/repositories/portfolio.repo"

type Item = {
  symbol: string
  amount: number
  priceUsd: number
  valueUsd: number
  percent: number
}

export const dynamic = "force-dynamic"

export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.accountId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    const accountId = session.accountId

    const [openBuys, cashUsd] = await Promise.all([
      prisma.journal_entry.findMany({
        where: {
          account_id: accountId,
          spot_trade: { some: {} },
          status: "in_progress",
          side: "buy",
          asset_name: { not: "CASH" },
        },
        select: {
          asset_name: true,
          amount: true,
          entry_price: true,
        },
      }),
      PortfolioRepo.getCashBalance(accountId),
    ])

    const grouped: Record<
      string,
      { qty: number; costBasis: number }
    > = {}

    for (const row of openBuys) {
      const sym = row.asset_name
      const qty = Number(row.amount ?? 0)
      const price = Number(row.entry_price ?? 0)

      if (!grouped[sym]) {
        grouped[sym] = { qty: 0, costBasis: 0 }
      }

      grouped[sym].qty += qty
      grouped[sym].costBasis += qty * price
    }

    const symbols = Object.keys(grouped)

    const spotTotal = symbols.reduce(
      (sum, sym) => sum + grouped[sym].costBasis,
      0
    )

    const items: Item[] = symbols
      .map((sym) => {
        const g = grouped[sym]
        const amount = g.qty
        const valueUsd = g.costBasis
        const priceUsd = amount > 0 ? valueUsd / amount : 0

        return {
          symbol: sym,
          amount,
          priceUsd,
          valueUsd,
          percent: spotTotal > 0 ? (valueUsd / spotTotal) * 100 : 0,
        }
      })
      .sort((a, b) => b.valueUsd - a.valueUsd)

    const totalValueUsd = spotTotal + cashUsd

    return NextResponse.json({
      totalValueUsd,
      cashUsd,
      items,
    })
  } catch (e: unknown) {
    const err = e as { code?: string }
    if (err?.code === "P2024") {
      return NextResponse.json({ error: "Database busy, try again." }, { status: 503 })
    }
    console.error("[GET /api/portfolio] error:", e)
    return NextResponse.json({ error: "Internal error" }, { status: 500 })
  }
}
