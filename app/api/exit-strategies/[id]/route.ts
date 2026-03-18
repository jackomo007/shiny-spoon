import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import {
  buildExitStrategyDetails,
  parseExcludedCoinSymbols,
  serializeExcludedCoinSymbols,
} from "@/services/exit-strategy.service"
import { getOpenSpotHoldings } from "@/services/portfolio-holdings.service"

export const dynamic = "force-dynamic"

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params

    const session = await getServerSession(authOptions)
    if (!session?.accountId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const data = await buildExitStrategyDetails(session.accountId, id, 10)
    return NextResponse.json({ data })
  } catch (e) {
    console.error("[GET /api/exit-strategies/[id]] error:", e)
    return NextResponse.json({ error: "Internal error" }, { status: 500 })
  }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const coinSymbolParam = new URL(req.url).searchParams.get("coinSymbol")
    const coinSymbol = coinSymbolParam?.trim().toUpperCase() || null

    const session = await getServerSession(authOptions)
    if (!session?.accountId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const accountId = session.accountId

    const row = await prisma.exit_strategy.findFirst({
      where: { id, account_id: accountId },
      select: {
        id: true,
        coin_symbol: true,
        is_all_coins: true,
        excluded_coin_symbols_json: true,
        strategy_type: true,
        sell_percent: true,
        gain_percent: true,
        is_active: true,
      },
    })
    if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 })

    if (!coinSymbol) {
      await prisma.exit_strategy.delete({ where: { id } })
      return new Response(null, { status: 204 })
    }

    if (!row.is_all_coins) {
      if (row.coin_symbol.trim().toUpperCase() !== coinSymbol) {
        return NextResponse.json({ error: "Asset not found in plan" }, { status: 404 })
      }

      await prisma.exit_strategy.delete({ where: { id } })
      return new Response(null, { status: 204 })
    }

    const holdings = await getOpenSpotHoldings(accountId)
    const excludedCoins = new Set(
      parseExcludedCoinSymbols(row.excluded_coin_symbols_json),
    )
    const planCoins = Array.from(
      new Set(
        holdings
          .map((holding) => holding.symbol.trim().toUpperCase())
          .filter((holdingCoin) => holdingCoin && !excludedCoins.has(holdingCoin)),
      ),
    ).sort((a, b) => a.localeCompare(b))

    if (!planCoins.includes(coinSymbol)) {
      return NextResponse.json({ error: "Asset not found in plan" }, { status: 404 })
    }

    const nextExcludedCoins = [...excludedCoins, coinSymbol]

    if (planCoins.length === 1) {
      await prisma.exit_strategy.delete({ where: { id } })
      return new Response(null, { status: 204 })
    }

    await prisma.exit_strategy.update({
      where: { id },
      data: {
        excluded_coin_symbols_json: serializeExcludedCoinSymbols(nextExcludedCoins),
      },
    })

    return new Response(null, { status: 204 })
  } catch (e) {
    console.error("[DELETE /api/exit-strategies/[id]] error:", e)
    return NextResponse.json({ error: "Internal error" }, { status: 500 })
  }
}
