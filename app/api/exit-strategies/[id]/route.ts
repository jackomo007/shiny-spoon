import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { buildExitStrategyDetails } from "@/services/exit-strategy.service"
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
        strategy_type: true,
        sell_percent: true,
        gain_percent: true,
        is_active: true,
        executions: {
          orderBy: { step_gain_percent: "asc" },
          select: {
            step_gain_percent: true,
            target_price: true,
            executed_price: true,
            quantity_sold: true,
            proceeds: true,
            realized_profit: true,
            executed_at: true,
          },
        },
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
    const planCoins = Array.from(
      new Set(
        holdings
          .map((holding) => holding.symbol.trim().toUpperCase())
          .filter(Boolean),
      ),
    ).sort((a, b) => a.localeCompare(b))

    if (!planCoins.includes(coinSymbol)) {
      return NextResponse.json({ error: "Asset not found in plan" }, { status: 404 })
    }

    const remainingCoins = planCoins.filter((coin) => coin !== coinSymbol)

    await prisma.$transaction(async (tx) => {
      if (remainingCoins.length > 0) {
        const existingStrategies = await tx.exit_strategy.findMany({
          where: {
            account_id: accountId,
            is_all_coins: false,
            strategy_type: row.strategy_type,
            coin_symbol: { in: remainingCoins },
          },
          select: { coin_symbol: true },
        })

        const existingCoins = new Set(
          existingStrategies.map((strategy) =>
            strategy.coin_symbol.trim().toUpperCase(),
          ),
        )

        const coinsToCreate = remainingCoins.filter(
          (coin) => !existingCoins.has(coin),
        )

        for (const coin of coinsToCreate) {
          const created = await tx.exit_strategy.create({
            data: {
              account_id: accountId,
              coin_symbol: coin,
              is_all_coins: false,
              strategy_type: row.strategy_type,
              sell_percent: row.sell_percent,
              gain_percent: row.gain_percent,
              is_active: row.is_active,
            },
            select: { id: true },
          })

          if (row.executions.length > 0) {
            await tx.exit_strategy_execution.createMany({
              data: row.executions.map((execution) => ({
                exit_strategy_id: created.id,
                step_gain_percent: execution.step_gain_percent,
                target_price: execution.target_price,
                executed_price: execution.executed_price,
                quantity_sold: execution.quantity_sold,
                proceeds: execution.proceeds,
                realized_profit: execution.realized_profit,
                executed_at: execution.executed_at,
              })),
            })
          }
        }
      }

      await tx.exit_strategy.delete({ where: { id } })
    })

    return new Response(null, { status: 204 })
  } catch (e) {
    console.error("[DELETE /api/exit-strategies/[id]] error:", e)
    return NextResponse.json({ error: "Internal error" }, { status: 500 })
  }
}
