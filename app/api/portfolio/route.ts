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

export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.accountId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    const accountId = session.accountId

    const positions = (await PortfolioRepo.getPositions(accountId)) as Record<string, PosRow | undefined>
    if (!positions["CASH"]) positions["CASH"] = { qty: 0 }

    const symbols = Object.keys(positions).filter((s) => s !== "CASH")
    const prices = await PriceService.getPrices(symbols)

    const items = Object.entries(positions).map(([symbol, row0]) => {
      const row: PosRow = row0 ?? { qty: 0 }

      const linkedToJournal =
        row.hasJournal === true ||
        row.hasOnlyInitRows === false ||
        (Array.isArray(row.sources) && row.sources.includes("journal")) ||
        (typeof row.journalCount === "number" && row.journalCount > 0)

      const hasInit =
        (typeof row.initCount === "number" && row.initCount > 0) ||
        (Array.isArray(row.sources) && row.sources.includes("init")) ||
        row.hasOnlyInitRows === true

      const initOnly = hasInit && !linkedToJournal

      const price =
        symbol === "CASH"
          ? 1
          : Number.isFinite(prices[symbol])
          ? Number(prices[symbol])
          : Number(row.lastPrice ?? 0)

      const qty = Number(row.qty ?? 0)
      const value = qty * price

      return {
        symbol,
        amount: qty,
        priceUsd: price,
        valueUsd: value,
        percent: 0,
        canDelete: symbol !== "CASH" && initOnly,
      }
    })

    const total = items.reduce((s, i) => s + i.valueUsd, 0)
    const withPct = items.map((i) => ({ ...i, percent: total > 0 ? (i.valueUsd / total) * 100 : 0 }))
    const cashItem = withPct.find((i) => i.symbol === "CASH")

    return NextResponse.json({
      totalValueUsd: total,
      cashUsd: cashItem?.valueUsd ?? 0,
      items: withPct.sort((a, b) => (a.symbol === "CASH" ? -1 : b.valueUsd - a.valueUsd)),
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
