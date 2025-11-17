import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { PortfolioRepo } from "@/data/repositories/portfolio.repo"
import { PriceService } from "@/lib/price-service"

type PosRow = {
  qty: number
  lastPrice?: number | null
  hasJournal?: boolean
  hasOnlyInitRows?: boolean
  sources?: string[]
  journalCount?: number
  initCount?: number
}

export const dynamic = "force-dynamic"

export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.accountId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    const accountId = session.accountId

    const positions = (await PortfolioRepo.getPositions(accountId)) as Record<
      string,
      PosRow | undefined
    >

    const symbols = Object.keys(positions).filter((s) => s !== "CASH")
    const prices = await PriceService.getPrices(symbols)

    const rawItems = symbols
      .map((symbol) => {
        const row: PosRow = positions[symbol] ?? { qty: 0 }
        const qty = Number(row.qty ?? 0)

        if (qty <= 0) return null

        const price = Number.isFinite(prices[symbol])
          ? Number(prices[symbol])
          : Number(row.lastPrice ?? 0)

        const value = qty * price

        return {
          symbol,
          amount: qty,
          priceUsd: price,
          valueUsd: value,
        }
      })
      .filter(Boolean) as {
      symbol: string
      amount: number
      priceUsd: number
      valueUsd: number
    }[]

    const total = rawItems.reduce((s, i) => s + i.valueUsd, 0)

    const items = rawItems
      .map((i) => ({
        ...i,
        percent: total > 0 ? (i.valueUsd / total) * 100 : 0,
      }))
      .sort((a, b) => b.valueUsd - a.valueUsd)

    return NextResponse.json({
      totalValueUsd: total,
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
