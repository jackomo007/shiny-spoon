import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { cgPriceUsdByIdSafe } from "@/lib/markets/coingecko"

export const dynamic = "force-dynamic"

type PriceSource = "coingecko" | "binance" | "avg_entry"
type PriceResult = { priceUsd: number; source: PriceSource; isEstimated: boolean; change24hPct: number | null }

async function getBinancePriceUsdt(symbol: string): Promise<number> {
  const pair = symbol.endsWith("USDT") ? symbol : `${symbol}USDT`
  const url = `https://api.binance.com/api/v3/ticker/price?symbol=${encodeURIComponent(pair)}`
  const res = await fetch(url, { cache: "no-store" })
  if (!res.ok) throw new Error(`Binance HTTP ${res.status}`)
  const j = (await res.json()) as { price?: string }
  const p = Number(j.price)
  if (!Number.isFinite(p) || p <= 0) throw new Error("Invalid Binance price")
  return p
}

async function resolvePrice(symbol: string, coingeckoId: string | null, avgEntry: number): Promise<PriceResult> {
  if (coingeckoId) {
    const cg = await cgPriceUsdByIdSafe(coingeckoId)
    if (cg.ok) {
      return { priceUsd: cg.priceUsd, source: "coingecko", isEstimated: false, change24hPct: cg.change24hPct }
    }
  }

  try {
    const p = await getBinancePriceUsdt(symbol)
    return { priceUsd: p, source: "binance", isEstimated: false, change24hPct: null }
  } catch {
    // ignore
  }

  const p = Number(avgEntry)
  const safe = Number.isFinite(p) && p > 0 ? p : 0
  return { priceUsd: safe, source: "avg_entry", isEstimated: true, change24hPct: null }
}

type DbRow = {
  id: string
  asset_name: string
  side: "buy" | "sell"
  amount: unknown
  entry_price: unknown
  trade_datetime: Date
}

export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.accountId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const accountId = session.accountId

    // pega spot buys e sells
    const rows = (await prisma.journal_entry.findMany({
      where: {
        account_id: accountId,
        spot_trade: { some: {} },
        asset_name: { not: "CASH" },
        side: { in: ["buy", "sell"] },
      },
      orderBy: { trade_datetime: "desc" },
      select: {
        id: true,
        asset_name: true,
        side: true,
        amount: true,
        entry_price: true,
        trade_datetime: true,
      },
    })) as DbRow[]

    // agrupa pra calcular qty e avgEntry
    const grouped = new Map<
      string,
      {
        symbol: string
        qtyBought: number
        investedUsd: number
        // se você já tem coingeckoId em outra tabela, plug aqui.
        coingeckoId: string | null
      }
    >()

    for (const r of rows) {
      const symbol = String(r.asset_name || "").trim().toUpperCase()
      const qty = Number(r.amount ?? 0)
      const price = Number(r.entry_price ?? 0)

      if (!symbol || !Number.isFinite(qty) || qty <= 0 || !Number.isFinite(price) || price <= 0) continue

      const g = grouped.get(symbol) ?? { symbol, qtyBought: 0, investedUsd: 0, coingeckoId: null }
      if (r.side === "buy") {
        g.qtyBought += qty
        g.investedUsd += qty * price
      }
      grouped.set(symbol, g)
    }

    const assets = Array.from(grouped.values())
      .map(async (g) => {
        const avgEntry = g.qtyBought > 0 ? g.investedUsd / g.qtyBought : 0
        const pr = await resolvePrice(g.symbol, g.coingeckoId, avgEntry)

        const holdingsValueUsd = g.qtyBought * pr.priceUsd
        const currentProfitUsd = holdingsValueUsd - g.investedUsd
        const currentProfitPct = g.investedUsd > 0 ? (currentProfitUsd / g.investedUsd) * 100 : null

        return {
          symbol: g.symbol,
          name: null as string | null,
          coingeckoId: g.coingeckoId,
          priceUsd: pr.priceUsd,
          change24hPct: pr.change24hPct,
          totalInvestedUsd: g.investedUsd,
          avgPriceUsd: avgEntry,
          qtyHeld: g.qtyBought,
          holdingsValueUsd,
          currentProfitUsd,
          currentProfitPct,
          currentPriceSource: pr.source,
          currentPriceIsEstimated: pr.isEstimated,
        }
      })

    const assetRows = (await Promise.all(assets)).sort((a, b) => b.holdingsValueUsd - a.holdingsValueUsd)

    const currentBalanceUsd = assetRows.reduce((s, a) => s + a.holdingsValueUsd, 0)
    const totalInvestedUsd = assetRows.reduce((s, a) => s + a.totalInvestedUsd, 0)
    const unrealizedUsd = currentBalanceUsd - totalInvestedUsd
    const totalPct = totalInvestedUsd > 0 ? (unrealizedUsd / totalInvestedUsd) * 100 : 0

    return NextResponse.json({
      summary: {
        currentBalanceUsd,
        totalInvestedUsd,
        profit: {
          realized: { usd: 0 },
          unrealized: { usd: unrealizedUsd },
          total: { usd: unrealizedUsd, pct: totalPct },
        },
        portfolio24h: { pct: 0, usd: 0 },
        topPerformer: null,
      },
      assets: assetRows,
      transactions: [],
    })
  } catch (e) {
    console.error("[GET /api/portfolio] error:", e)
    return NextResponse.json({ error: "Internal error" }, { status: 500 })
  }
}
