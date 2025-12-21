import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { PortfolioRepo } from "@/data/repositories/portfolio.repo"
import { fetchTickerPrice } from "@/lib/klines"

type Item = {
  symbol: string
  amount: number
  avgEntryPriceUsd: number
  currentPriceUsd: number
  purchaseValueUsd: number
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

    const grouped: Record<string, { qty: number; investedUsd: number }> = {}

    for (const row of openBuys) {
      const sym = String(row.asset_name || "").trim().toUpperCase()
      const qty = Number(row.amount ?? 0)
      const entry = Number(row.entry_price ?? 0)

      if (!sym || qty <= 0) continue

      if (!grouped[sym]) grouped[sym] = { qty: 0, investedUsd: 0 }
      grouped[sym].qty += qty
      grouped[sym].investedUsd += qty * entry
    }

    const symbols = Object.keys(grouped)

    const currentPriceBySymbol = new Map<string, number>()

    await Promise.all(
      symbols.map(async (sym) => {
        const pair = sym.endsWith("USDT") ? sym : `${sym}USDT`
        try {
          const p = await fetchTickerPrice(pair)
          currentPriceBySymbol.set(sym, p)
        } catch {
          // fallback handled below (avgEntryPriceUsd)
        }
      })
    )

    const spotInvestedUsd = symbols.reduce((sum, sym) => sum + grouped[sym].investedUsd, 0)

    const spotCurrentValueUsd = symbols.reduce((sum, sym) => {
      const g = grouped[sym]
      const avgEntry = g.qty > 0 ? g.investedUsd / g.qty : 0
      const current = currentPriceBySymbol.get(sym) ?? avgEntry
      return sum + g.qty * current
    }, 0)

    const items: Item[] = symbols
      .map((sym) => {
        const g = grouped[sym]
        const amount = g.qty
        const avgEntryPriceUsd = amount > 0 ? g.investedUsd / amount : 0
        const currentPriceUsd = currentPriceBySymbol.get(sym) ?? avgEntryPriceUsd
        const valueUsd = amount * currentPriceUsd
        const purchaseValueUsd = amount * avgEntryPriceUsd

        return {
          symbol: sym,
          amount,
          avgEntryPriceUsd,
          currentPriceUsd,
          purchaseValueUsd,
          valueUsd,
          percent: spotCurrentValueUsd > 0 ? (valueUsd / spotCurrentValueUsd) * 100 : 0,
        }
      })
      .sort((a, b) => b.valueUsd - a.valueUsd)

    const totalValueUsd = spotCurrentValueUsd + (cashUsd ?? 0)

    const totalInvestedUsd = spotInvestedUsd + (cashUsd ?? 0)

    return NextResponse.json({
      totalValueUsd,
      totalInvestedUsd,
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
