import { prisma } from "@/lib/prisma"

type Side = "buy" | "sell"

export type SpotTxRow = {
  id: string
  symbol: string
  side: Side
  qty: number
  priceUsd: number
  feeUsd: number
  executedAt: Date
}

function statusFromPnl(pnlUsd: number): "win" | "loss" | "break_even" {
  if (Math.abs(pnlUsd) < 0.01) return "break_even"
  return pnlUsd > 0 ? "win" : "loss"
}

async function avgCostBeforeSell(params: {
  accountId: string
  symbol: string
  executedAt: Date
}): Promise<number> {
  const symbol = params.symbol.trim().toUpperCase()

  const rows = await prisma.journal_entry.findMany({
    where: {
      account_id: params.accountId,
      spot_trade: { some: {} },
      asset_name: symbol,
      side: { in: ["buy", "sell"] },
      trade_datetime: { lt: params.executedAt },
    },
    orderBy: { trade_datetime: "asc" },
    select: {
      side: true,
      amount: true,
      entry_price: true,
      buy_fee: true,
      sell_fee: true,
    },
  })

  let qtyHeld = 0
  let costBasisUsd = 0

  for (const r of rows) {
    const side = r.side as Side
    const qty = Number(r.amount ?? 0)
    const price = Number(r.entry_price ?? 0)
    const fee = Number(side === "buy" ? r.buy_fee : r.sell_fee) || 0

    if (!Number.isFinite(qty) || qty <= 0) continue
    if (!Number.isFinite(price) || price <= 0) continue

    const total = qty * price

    if (side === "buy") {
      qtyHeld += qty
      costBasisUsd += total + fee
    } else {
      const avg = qtyHeld > 0 ? costBasisUsd / qtyHeld : 0
      const reduceQty = Math.min(qty, qtyHeld)

      qtyHeld -= reduceQty
      costBasisUsd -= reduceQty * avg

      if (qtyHeld < 1e-10) {
        qtyHeld = 0
        costBasisUsd = 0
      }
    }
  }

  const avg = qtyHeld > 0 ? costBasisUsd / qtyHeld : 0
  return Number.isFinite(avg) && avg > 0 ? avg : 0
}

export const PortfolioRepoV2 = {
  async ensureDefaultJournal(accountId: string) {
    const existing = await prisma.journal.findFirst({
      where: { account_id: accountId },
      select: { id: true },
    })
    if (existing?.id) return existing.id

    const created = await prisma.journal.create({
      data: { account_id: accountId, name: "Main" },
      select: { id: true },
    })
    return created.id
  },

  async ensureNoneStrategy(accountId: string) {
    const existing = await prisma.strategy.findFirst({
      where: { account_id: accountId },
      select: { id: true },
      orderBy: { date_created: "asc" },
    })
    if (existing?.id) return existing.id

    const created = await prisma.strategy.create({
      data: { account_id: accountId, name: "None", notes: "Auto-created default strategy." },
      select: { id: true },
    })
    return created.id
  },

  async listSpotTransactions(accountId: string): Promise<SpotTxRow[]> {
    const rows = await prisma.journal_entry.findMany({
      where: {
        account_id: accountId,
        spot_trade: { some: {} },
        asset_name: { not: "CASH" },
        side: { in: ["buy", "sell"] },
      },
      select: {
        id: true,
        asset_name: true,
        side: true,
        amount: true,
        entry_price: true,
        buy_fee: true,
        sell_fee: true,
        trade_datetime: true,
      },
      orderBy: { trade_datetime: "desc" },
      take: 250,
    })

    return rows.map((r) => {
      const side = r.side as Side
      const feeUsd = Number(side === "buy" ? r.buy_fee : r.sell_fee) || 0

      return {
        id: r.id,
        symbol: String(r.asset_name).toUpperCase(),
        side,
        qty: Number(r.amount ?? 0),
        priceUsd: Number(r.entry_price ?? 0),
        feeUsd,
        executedAt: new Date(r.trade_datetime),
      }
    })
  },

  async createSpotTransaction(params: {
    accountId: string
    symbol: string
    side: Side
    qty: number
    priceUsd: number
    feeUsd?: number
    executedAt: Date
    notes?: string | null
  }) {
    const journalId = await this.ensureDefaultJournal(params.accountId)
    const strategyId = await this.ensureNoneStrategy(params.accountId)

    const symbol = params.symbol.trim().toUpperCase()
    const qty = params.qty
    const priceUsd = params.priceUsd
    const feeUsd = params.feeUsd ?? 0

    let entry_price = priceUsd
    let exit_price: number | null = null
    let status: "in_progress" | "win" | "loss" | "break_even" = "in_progress"
    let amount_spent = qty * priceUsd

    const buy_fee = params.side === "buy" ? feeUsd : 0
    const sell_fee = params.side === "sell" ? feeUsd : 0

    if (params.side === "sell") {
      const avgEntry = await avgCostBeforeSell({
        accountId: params.accountId,
        symbol,
        executedAt: params.executedAt,
      })

      entry_price = avgEntry > 0 ? avgEntry : priceUsd
      exit_price = priceUsd

      amount_spent = qty * entry_price

      const pnlNet = (exit_price - entry_price) * qty - sell_fee
      status = statusFromPnl(pnlNet)
    }

    const je = await prisma.journal_entry.create({
      data: {
        account_id: params.accountId,
        trade_type: 0,
        asset_name: symbol,
        side: params.side,
        status,
        entry_price,
        exit_price,
        amount: qty,
        trade_datetime: params.executedAt,
        strategy_id: strategyId,
        notes_entry: params.notes ?? null,
        strategy_rule_match: 0,
        amount_spent,
        journal_id: journalId,
        buy_fee,
        sell_fee,
        timeframe_code: "1D",
        trading_fee: 0,
      },
      select: { id: true },
    })

    await prisma.spot_trade.create({
      data: { journal_entry_id: je.id },
      select: { id: true },
    })

    return je.id
  },
}