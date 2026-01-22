import { prisma } from "@/lib/prisma"
import { resolveCurrentPriceUsd } from "@/lib/current-price"
import { getOpenSpotHolding } from "@/services/portfolio-holdings.service"

export type ExitStrategySummary = {
  id: string
  coinSymbol: string
  strategyType: "percentage"
  sellPercent: number
  gainPercent: number
  isActive: boolean

  qtyOpen: number
  entryPriceUsd: number

  currentPriceUsd: number
  currentPriceSource: "binance" | "coingecko" | "db_cache" | "avg_entry"
  currentPriceIsEstimated: boolean

  nextGainPercent: number
  targetPriceUsd: number
  qtyToSell: number
  usdValueToSell: number
  distanceToTargetPercent: number

  status: "pending" | "ready"
}

export type ExitStrategyStepRow = {
  gainPercent: number
  targetPriceUsd: number
  plannedQtyToSell: number
  executedQtyToSell: number | null
  proceedsUsd: number
  remainingQtyAfter: number
  realizedProfitUsd: number
  cumulativeRealizedProfitUsd: number
  isExecuted?: boolean
}

function round(n: number, digits: number): number {
  const p = 10 ** digits
  return Math.round(n * p) / p
}

export async function buildExitStrategySummary(accountId: string, strategyId: string): Promise<ExitStrategySummary> {
  const s = await prisma.exit_strategy.findFirst({
    where: { id: strategyId, account_id: accountId },
    select: {
      id: true,
      coin_symbol: true,
      strategy_type: true,
      sell_percent: true,
      gain_percent: true,
      is_active: true,
    },
  })
  if (!s) throw new Error("Exit strategy not found")

  const coin = s.coin_symbol.toUpperCase()
  const sellPercent = Number(s.sell_percent)
  const gainPercent = Number(s.gain_percent)

  const holding = await getOpenSpotHolding(accountId, coin)
  const qtyOpen = holding?.qty ?? 0
  const entryPriceUsd = holding?.avgEntryPriceUsd ?? 0

  const execs = await prisma.exit_strategy_execution.findMany({
    where: { exit_strategy_id: s.id },
    orderBy: { step_gain_percent: "asc" },
    select: { step_gain_percent: true },
  })

  const executedSteps = new Set(execs.map((e) => round(Number(e.step_gain_percent), 2)))

  let nextGain = gainPercent
  for (let i = 1; i <= 50; i++) {
    const candidate = round(gainPercent * i, 2)
    if (!executedSteps.has(candidate)) {
      nextGain = candidate
      break
    }
  }

  const targetPriceUsd = entryPriceUsd > 0 ? entryPriceUsd * (1 + nextGain / 100) : 0

  const priceRes = await resolveCurrentPriceUsd(accountId, coin, entryPriceUsd)
  const currentPriceUsd = priceRes.price

  const qtyToSell = qtyOpen > 0 ? qtyOpen * (sellPercent / 100) : 0
  const usdValueToSell = qtyToSell * targetPriceUsd

  const distanceToTargetPercent =
    currentPriceUsd > 0 && targetPriceUsd > 0
      ? Math.max(((targetPriceUsd - currentPriceUsd) / currentPriceUsd) * 100, 0)
      : 0

  const ready = currentPriceUsd >= targetPriceUsd && targetPriceUsd > 0

  return {
    id: s.id,
    coinSymbol: coin,
    strategyType: "percentage",
    sellPercent,
    gainPercent,
    isActive: s.is_active,

    qtyOpen: round(qtyOpen, 8),
    entryPriceUsd: round(entryPriceUsd, 8),

    currentPriceUsd: round(currentPriceUsd, 8),
    currentPriceSource: priceRes.source,
    currentPriceIsEstimated: priceRes.isEstimated,

    nextGainPercent: nextGain,
    targetPriceUsd: round(targetPriceUsd, 8),
    qtyToSell: round(qtyToSell, 8),
    usdValueToSell: round(usdValueToSell, 2),
    distanceToTargetPercent: round(distanceToTargetPercent, 2),

    status: ready ? "ready" : "pending",
  }
}

export async function buildExitStrategyDetails(
  accountId: string,
  strategyId: string,
  maxSteps = 10
): Promise<{ summary: ExitStrategySummary; rows: ExitStrategyStepRow[] }> {
  const summary = await buildExitStrategySummary(accountId, strategyId)

  const s = await prisma.exit_strategy.findFirst({
    where: { id: strategyId, account_id: accountId },
    select: { coin_symbol: true, sell_percent: true, gain_percent: true },
  })
  if (!s) throw new Error("Exit strategy not found")

  const coin = s.coin_symbol.toUpperCase()
  const holding = await getOpenSpotHolding(accountId, coin)

  const entryPriceUsd = holding?.avgEntryPriceUsd ?? 0
  let remaining = holding?.qty ?? 0

  const sellPct = Number(s.sell_percent) / 100
  const gainStep = Number(s.gain_percent)

  const executions = await prisma.exit_strategy_execution.findMany({
    where: { exit_strategy_id: strategyId },
    orderBy: { step_gain_percent: "asc" },
    select: {
      step_gain_percent: true,
      target_price: true,
      executed_price: true,
      quantity_sold: true,
      proceeds: true,
      realized_profit: true,
    },
  })

  const execByGain = new Map<number, (typeof executions)[number]>()
  for (const e of executions) execByGain.set(round(Number(e.step_gain_percent), 2), e)

  const rows: ExitStrategyStepRow[] = []
  let cumulative = 0

  for (let i = 1; i <= maxSteps; i++) {
    const gain = round(gainStep * i, 2)
    const target = entryPriceUsd > 0 ? entryPriceUsd * (1 + gain / 100) : 0

    const plannedQty = remaining > 0 ? remaining * sellPct : 0
    const exec = execByGain.get(gain)

    const isExecuted = !!exec
    const executedQty = exec ? Number(exec.quantity_sold) : null

    const qtySoldNow = isExecuted ? Number(exec!.quantity_sold) : plannedQty

    remaining = Math.max(remaining - qtySoldNow, 0)

    const sellPrice = isExecuted ? Number(exec!.executed_price) : target

    const proceeds = isExecuted ? Number(exec!.proceeds) : qtySoldNow * sellPrice
    const profit = isExecuted ? Number(exec!.realized_profit) : qtySoldNow * (sellPrice - entryPriceUsd)

    cumulative += profit

    rows.push({
      gainPercent: gain,
      targetPriceUsd: round(target, 8),
      plannedQtyToSell: round(plannedQty, 8),
      executedQtyToSell: executedQty != null ? round(executedQty, 8) : null,
      proceedsUsd: round(proceeds, 2),
      remainingQtyAfter: round(remaining, 8),
      realizedProfitUsd: round(profit, 2),
      cumulativeRealizedProfitUsd: round(cumulative, 2),
      isExecuted,
    })

    if (remaining <= 0) break
  }

  return { summary, rows }
}
