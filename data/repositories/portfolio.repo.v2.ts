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

export type HoldingRow = {
  symbol: string
  qtyBought: number
  qtySold: number
  investedUsd: number // sum(qty * price) for buys
  proceedsUsd: number // sum(qty * price) for sells
  feesUsd: number
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
        trade_datetime: true,
      },
      orderBy: { trade_datetime: "desc" },
      take: 250,
    })

    return rows.map((r) => ({
      id: r.id,
      symbol: String(r.asset_name).toUpperCase(),
      side: r.side as Side,
      qty: Number(r.amount ?? 0),
      priceUsd: Number(r.entry_price ?? 0),
      feeUsd: Number(r.buy_fee ?? 0),
      executedAt: new Date(r.trade_datetime),
    }))
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

    // trade_type: você pode ter um enum/const interno no projeto.
    // Aqui usamos 0 para "spot". Se no seu app for outro valor, ajuste aqui.
    const tradeType = 0

    const je = await prisma.journal_entry.create({
      data: {
        account_id: params.accountId,
        trade_type: tradeType,
        asset_name: params.symbol.toUpperCase(),
        side: params.side,
        status: "in_progress",
        entry_price: params.priceUsd,
        amount: params.qty,
        trade_datetime: params.executedAt,
        strategy_id: strategyId,
        notes_entry: params.notes ?? null,
        strategy_rule_match: 0,
        amount_spent: params.qty * params.priceUsd,
        journal_id: journalId,
        buy_fee: params.feeUsd ?? 0,
        sell_fee: 0,
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
