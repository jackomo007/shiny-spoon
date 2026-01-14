import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

async function getCurrentPriceUsdFallback(
  coinSymbol: string,
  entryPriceUsd: number
): Promise<{ price: number; source: "avg_entry"; isEstimated: true }> {
  return { price: entryPriceUsd || 0, source: "avg_entry", isEstimated: true }
}

export const dynamic = "force-dynamic"

function toNumber(v: unknown): number {
  if (typeof v === "number") return v
  if (typeof v === "string") return Number(v)
  if (v && typeof (v as { toNumber?: unknown }).toNumber === "function") {
    return (v as { toNumber: () => number }).toNumber()
  }
  return Number(v ?? 0)
}

async function getHoldingFromPortfolioTrades(accountId: string, coinSymbol: string) {
  const rows = await prisma.portfolio_trade.findMany({
    where: { account_id: accountId, asset_name: coinSymbol },
    select: { kind: true, qty: true, price_usd: true },
    orderBy: { trade_datetime: "asc" },
  })

  let qtyOpen = 0
  let buyQty = 0
  let buyNotional = 0

  for (const r of rows) {
    const kind = String(r.kind || "").toLowerCase()
    const qty = toNumber(r.qty)
    const px = toNumber(r.price_usd)

    if (kind === "buy") {
      qtyOpen += qty
      buyQty += qty
      buyNotional += qty * px
    } else if (kind === "sell") {
      qtyOpen -= qty
    } else {
    }
  }

  const entryPriceUsd = buyQty > 0 ? buyNotional / buyQty : 0

  return {
    qtyOpen: Math.max(0, qtyOpen),
    entryPriceUsd,
  }
}

function round(n: number, d = 8) {
  const p = 10 ** d
  return Math.round(n * p) / p
}

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params

    const session = await getServerSession(authOptions)
    if (!session?.accountId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    const accountId = session.accountId

    const strategy = await prisma.exit_strategy.findFirst({
      where: { id, account_id: accountId },
      select: {
        id: true,
        coin_symbol: true,
        strategy_type: true,
        sell_percent: true,
        gain_percent: true,
        is_active: true,
        executions: {
          select: {
            step_gain_percent: true,
            target_price: true,
            executed_price: true,
            quantity_sold: true,
            proceeds: true,
            realized_profit: true,
            executed_at: true,
          },
          orderBy: { step_gain_percent: "asc" },
        },
      },
    })

    if (!strategy) {
      return NextResponse.json({ error: "Not found" }, { status: 404 })
    }

    const coinSymbol = strategy.coin_symbol
    const sellPercent = toNumber(strategy.sell_percent)
    const gainPercent = toNumber(strategy.gain_percent)

    const holding = await getHoldingFromPortfolioTrades(accountId, coinSymbol)
    const qtyOpen = holding.qtyOpen
    const entryPriceUsd = holding.entryPriceUsd

    const priceInfo = await getCurrentPriceUsdFallback(coinSymbol, entryPriceUsd)
    const currentPriceUsd = priceInfo.price
    const currentPriceSource = priceInfo.source
    const currentPriceIsEstimated = priceInfo.isEstimated

    const executions = strategy.executions.map((e) => ({
      stepGainPercent: toNumber(e.step_gain_percent),
      targetPrice: toNumber(e.target_price),
      executedPrice: toNumber(e.executed_price),
      quantitySold: toNumber(e.quantity_sold),
      proceeds: toNumber(e.proceeds),
      realizedProfit: toNumber(e.realized_profit),
      executedAt: e.executed_at,
    }))

    const lastExecutedGain = executions.length ? Math.max(...executions.map((x) => x.stepGainPercent)) : 0

    const currentGainPercent = entryPriceUsd > 0 ? ((currentPriceUsd - entryPriceUsd) / entryPriceUsd) * 100 : 0

    const nextGainPercent = gainPercent > 0 ? lastExecutedGain + gainPercent : 0

    const targetPriceUsd = entryPriceUsd > 0 ? entryPriceUsd * (1 + nextGainPercent / 100) : 0
    const distanceToTargetPercent = nextGainPercent > 0 ? Math.max(0, nextGainPercent - currentGainPercent) : 0

    const status = targetPriceUsd > 0 && currentPriceUsd >= targetPriceUsd ? "ready" : "pending"

    const qtyToSell = qtyOpen > 0 ? (qtyOpen * sellPercent) / 100 : 0
    const usdValueToSell = qtyToSell * targetPriceUsd

    const maxSteps = 10
    const rows: Array<{
      gainPercent: number
      targetPriceUsd: number
      plannedQtyToSell: number
      executedQtyToSell: number | null
      proceedsUsd: number | null
      remainingQtyAfter: number
      realizedProfitUsd: number | null
      cumulativeRealizedProfitUsd: number
    }> = []

    let remaining = qtyOpen
    let cumulative = 0

    for (let i = 1; i <= maxSteps; i++) {
      const stepGain = gainPercent > 0 ? i * gainPercent : 0
      const stepTarget = entryPriceUsd > 0 ? entryPriceUsd * (1 + stepGain / 100) : 0

      const planned = remaining > 0 ? (remaining * sellPercent) / 100 : 0

      const exec = executions.find((x) => x.stepGainPercent === stepGain) || null
      const executedQty = exec ? exec.quantitySold : null
      const proceeds = exec ? exec.proceeds : null
      const profit = exec ? exec.realizedProfit : null

      if (profit != null) cumulative += profit

      const usedQty = executedQty != null ? executedQty : planned
      remaining = Math.max(0, remaining - usedQty)

      rows.push({
        gainPercent: stepGain,
        targetPriceUsd: stepTarget,
        plannedQtyToSell: round(planned, 8),
        executedQtyToSell: executedQty != null ? round(executedQty, 8) : null,
        proceedsUsd: proceeds != null ? proceeds : null,
        remainingQtyAfter: round(remaining, 8),
        realizedProfitUsd: profit != null ? profit : null,
        cumulativeRealizedProfitUsd: cumulative,
      })

      if (remaining <= 0) break
    }

    const summary = {
      id: strategy.id,
      coinSymbol,
      strategyType: "percentage" as const,
      sellPercent,
      gainPercent,
      isActive: !!strategy.is_active,

      qtyOpen,
      entryPriceUsd,

      currentPriceUsd,
      currentPriceSource,
      currentPriceIsEstimated,

      nextGainPercent,
      targetPriceUsd,
      qtyToSell,
      usdValueToSell,
      distanceToTargetPercent,

      status,
    }

    return NextResponse.json({ data: { summary, rows } })
  } catch (e) {
    console.error("[GET /api/exit-strategies/[id]] error:", e)
    return NextResponse.json({ error: "Internal error" }, { status: 500 })
  }
}

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params

    const session = await getServerSession(authOptions)
    if (!session?.accountId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const accountId = session.accountId

    const row = await prisma.exit_strategy.findFirst({
      where: { id, account_id: accountId },
      select: { id: true },
    })

    if (!row) {
      return NextResponse.json({ error: "Not found" }, { status: 404 })
    }

    await prisma.exit_strategy.delete({ where: { id } })

    return new Response(null, { status: 204 })
  } catch (e) {
    console.error("[DELETE /api/exit-strategies/[id]] error:", e)
    return NextResponse.json({ error: "Internal error" }, { status: 500 })
  }
}
