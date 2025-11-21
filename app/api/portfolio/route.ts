import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { PortfolioRepo } from "@/data/repositories/portfolio.repo"
import { PriceService } from "@/lib/price-service"

type PosRow = {
  qty: number
  lastPrice?: number | null
  avgEntryPriceUsd?: number | null
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

    const [positions, cashUsd] = await Promise.all([
      PortfolioRepo.getPositions(accountId) as Promise<
        Record<string, PosRow | undefined>
      >,
      PortfolioRepo.getCashBalance(accountId),
    ])

    const symbols = Object.keys(positions).filter((s) => s !== "CASH")
    const prices = await PriceService.getPrices(symbols)

    const EPS = 1e-8;

    const rawItems = symbols
      .map((symbol) => {
        const row: PosRow = positions[symbol] ?? { qty: 0 };
        const qty = Number(row.qty ?? 0);

        if (Math.abs(qty) <= EPS) return null;

        const entryPrice = Number(row.avgEntryPriceUsd ?? row.lastPrice ?? 0);

        const marketPrice = Number.isFinite(prices[symbol])
          ? Number(prices[symbol])
          : entryPrice;

        const value = qty * marketPrice;

        return {
          symbol,
          amount: qty,
          priceUsd: entryPrice,
          valueUsd: value,
        };
      })
      .filter(
        (
          i
        ): i is {
          symbol: string;
          amount: number;
          priceUsd: number;
          valueUsd: number;
        } => i !== null
      );

    const spotTotal = rawItems.reduce((s, i) => s + i.valueUsd, 0)

    const items = rawItems
      .map((i) => ({
        ...i,
        percent: spotTotal > 0 ? (i.valueUsd / spotTotal) * 100 : 0,
      }))
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
