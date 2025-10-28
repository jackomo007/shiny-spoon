import { prisma } from "@/lib/prisma"
import { journal_entry_side } from "@prisma/client"

type PositionRow = {
  asset_name: string
  side: journal_entry_side
  _sum: { amount: number | null }
}

export type PositionsMap = Record<
  string,
  {
    qty: number
    lastPrice?: number
    initCount?: number
    journalCount?: number
    hasOnlyInitRows?: boolean
    hasJournal?: boolean
    sources?: string[]
  }
>

async function ensureDefaultJournalId(accountId: string) {
  const existing = await prisma.journal.findFirst({
    where: { account_id: accountId, name: "Portfolio" },
    select: { id: true },
  })
  if (existing) return existing.id

  const created = await prisma.journal.create({
    data: { account_id: accountId, name: "Portfolio" },
    select: { id: true },
  })
  return created.id
}

async function ensureDefaultStrategyId(accountId: string) {
  const existing = await prisma.strategy.findFirst({
    where: { account_id: accountId, name: "Portfolio" },
    select: { id: true },
  })
  if (existing) return existing.id

  const created = await prisma.strategy.create({
    data: { account_id: accountId, name: "Portfolio" },
    select: { id: true },
  })
  return created.id
}

async function ensureNoneStrategyId(accountId: string) {
  const existing = await prisma.strategy.findFirst({
    where: { account_id: accountId, name: "None" },
    select: { id: true },
  })
  if (existing) return existing.id

  const created = await prisma.strategy.create({
    data: { account_id: accountId, name: "None" },
    select: { id: true },
  })
  return created.id
}

export const PortfolioRepo = {
  async getPositions(accountId: string): Promise<PositionsMap> {
    const grouped = await prisma.journal_entry.groupBy({
      by: ["asset_name", "side"],
      where: {
        account_id: accountId,
        spot_trade: { some: {} },
      },
      _sum: { amount: true },
    })

    const map: PositionsMap = {}
    for (const row of grouped as PositionRow[]) {
      const symbol = row.asset_name
      const sum = Number(row._sum.amount ?? 0)
      const signed = row.side === "buy" ? sum : -sum
      map[symbol] = map[symbol] ?? { qty: 0 }
      map[symbol].qty += signed
    }

    const symbols = Object.keys(map).filter((s) => s !== "CASH")
    if (symbols.length) {
      const lastBy = await prisma.journal_entry.findMany({
        where: {
          account_id: accountId,
          asset_name: { in: symbols },
          spot_trade: { some: {} },
        },
        orderBy: { trade_datetime: "desc" },
        distinct: ["asset_name"],
        select: { asset_name: true, entry_price: true },
      })
      for (const row of lastBy) {
        map[row.asset_name].lastPrice = Number(row.entry_price)
      }
    }

    const initBy = await prisma.journal_entry.groupBy({
      by: ["asset_name"],
      where: {
        account_id: accountId,
        spot_trade: { some: {} },
        notes_entry: "[PORTFOLIO_ADD]",
      },
      _count: { _all: true },
    })

    const journalBy = await prisma.journal_entry.groupBy({
      by: ["asset_name"],
      where: {
        account_id: accountId,
        spot_trade: { some: {} },
        NOT: { notes_entry: "[PORTFOLIO_ADD]" },
      },
      _count: { _all: true },
    })

    const toCountMap = (rows: { asset_name: string; _count: { _all: number } }[]) =>
      rows.reduce<Record<string, number>>((acc, r) => {
        acc[r.asset_name] = r._count._all
        return acc
      }, {})

    const initCountMap = toCountMap(initBy)
    const journalCountMap = toCountMap(journalBy)

    for (const sym of Object.keys(map)) {
      const initCount = initCountMap[sym] ?? 0
      const journalCount = journalCountMap[sym] ?? 0
      const hasInit = initCount > 0
      const linkedToJournal = journalCount > 0

      map[sym].initCount = initCount
      map[sym].journalCount = journalCount
      map[sym].hasOnlyInitRows = hasInit && !linkedToJournal
      map[sym].hasJournal = linkedToJournal
      map[sym].sources = [
        ...(hasInit ? ["init"] : []),
        ...(linkedToJournal ? ["journal"] : []),
      ]
    }

    return map
  },

  async getCashBalance(accountId: string): Promise<number> {
    const cash = await prisma.journal_entry.groupBy({
      by: ["side"],
      where: {
        account_id: accountId,
        asset_name: "CASH",
        spot_trade: { some: {} },
      },
      _sum: { amount: true },
    })
    const buys = Number(cash.find((c) => c.side === "buy")?._sum.amount ?? 0)
    const sells = Number(cash.find((c) => c.side === "sell")?._sum.amount ?? 0)
    return buys - sells
  },

  async createSpotBuyTx(opts: {
    accountId: string
    symbol: string
    priceUsd: number
    cashToSpend: number
    feeUsd: number
    tradeAt?: Date
    strategyId?: string | null
  }) {
    const { accountId, symbol, priceUsd, cashToSpend, feeUsd } = opts
    const qty = cashToSpend / priceUsd
    const when = opts.tradeAt ?? new Date()

    const chosenStrategyId =
      opts.strategyId === "NONE"
        ? await ensureNoneStrategyId(accountId)
        : (opts.strategyId ?? await ensureDefaultStrategyId(accountId))

    return prisma.$transaction(async (tx) => {
      const journalId = await ensureDefaultJournalId(accountId)

      const buy = await tx.journal_entry.create({
        data: {
          account_id: accountId,
          journal_id: journalId,
          trade_type: 0,
          asset_name: symbol,
          side: "buy",
          status: "in_progress",
          entry_price: priceUsd,
          buy_fee: feeUsd,
          amount_spent: cashToSpend + feeUsd,
          amount: qty,
          timeframe_code: "1D",
          trade_datetime: when,
          strategy_id: chosenStrategyId,
          strategy_rule_match: 0,
          spot_trade: { create: {} },
        },
      })

      await tx.journal_entry.create({
        data: {
          account_id: accountId,
          journal_id: journalId,
          trade_type: 0,
          asset_name: "CASH",
        side: "sell",
          status: "in_progress",
          entry_price: 1,
          amount_spent: cashToSpend + feeUsd,
          amount: cashToSpend + feeUsd,
          timeframe_code: "1D",
          trade_datetime: when,
          strategy_id: chosenStrategyId,
          strategy_rule_match: 0,
          spot_trade: { create: {} },
          notes_entry: "[PORTFOLIO_CASH_OUT]",
        },
      })

      return buy.id
    })
  },

  async createSpotSellTx(opts: {
    accountId: string
    symbol: string
    priceUsd: number
    amountToSell: number
    feeUsd: number
    tradeAt?: Date
    strategyId?: string | null
  }) {
    const { accountId } = opts
    const when = opts.tradeAt ?? new Date()
    const gross = opts.priceUsd * opts.amountToSell
    const net = gross - opts.feeUsd

    const chosenStrategyId =
      opts.strategyId === "NONE"
        ? await ensureNoneStrategyId(accountId)
        : (opts.strategyId ?? await ensureDefaultStrategyId(accountId))

    return prisma.$transaction(async (tx) => {
      const journalId = await ensureDefaultJournalId(accountId)

      const sell = await tx.journal_entry.create({
        data: {
          account_id: accountId,
          journal_id: journalId,
          trade_type: 0,
          asset_name: opts.symbol,
          side: "sell",
          status: "in_progress",
          entry_price: opts.priceUsd,
          sell_fee: opts.feeUsd,
          amount_spent: 0,
          amount: opts.amountToSell,
          timeframe_code: "1D",
          trade_datetime: when,
          strategy_id: chosenStrategyId,
          strategy_rule_match: 0,
          spot_trade: { create: {} },
        },
      })

      await tx.journal_entry.create({
        data: {
          account_id: accountId,
          journal_id: journalId,
          trade_type: 0,
          asset_name: "CASH",
          side: "buy",
          status: "in_progress",
          entry_price: 1,
          amount_spent: 0,
          amount: net,
          timeframe_code: "1D",
          trade_datetime: when,
          strategy_id: chosenStrategyId,
          strategy_rule_match: 0,
          spot_trade: { create: {} },
          notes_entry: "[PORTFOLIO_CASH_IN]",
        },
      })

      return sell.id
    })
  },

  async createCashAdjustment(opts: {
    accountId: string
    amountUsd: number
    kind: "deposit" | "withdraw"
    note?: string
    tradeAt?: Date  
  }) {
    const side: journal_entry_side = opts.kind === "deposit" ? "buy" : "sell"
    const [journalId, strategyId] = await Promise.all([
      ensureDefaultJournalId(opts.accountId),
      ensureDefaultStrategyId(opts.accountId),
    ])

     const when = opts.tradeAt ?? new Date() 

    return prisma.journal_entry.create({
      data: {
        account_id: opts.accountId,
        journal_id: journalId,
        trade_type: 0,
        asset_name: "CASH",
        side,
        status: "in_progress",
        entry_price: 1,
        amount_spent: 0,
        amount: opts.amountUsd,
        timeframe_code: "1D",
        trade_datetime: when, 
        strategy_id: strategyId,
        strategy_rule_match: 0,
        spot_trade: { create: {} },
        notes_entry: opts.note ?? "[PORTFOLIO_CASH_ADJUST]",
      },
    })
  },

  async createInitPosition(opts: {
    accountId: string
    symbol: string
    amount: number
    priceUsd: number
    feeUsd?: number
    strategyId?: string | null
    tradeAt?: Date 
  }) {
    const journalId = await ensureDefaultJournalId(opts.accountId)

    const chosenStrategyId =
      opts.strategyId === "NONE"
        ? await ensureNoneStrategyId(opts.accountId)
        : (opts.strategyId ?? await ensureDefaultStrategyId(opts.accountId))

    const when = opts.tradeAt ?? new Date()

    return prisma.journal_entry.create({
      data: {
        account_id: opts.accountId,
        journal_id: journalId,
        trade_type: 0,
        asset_name: opts.symbol,
        side: "buy",
        status: "in_progress",
        entry_price: opts.priceUsd,
        buy_fee: opts.feeUsd ?? 0,
        amount_spent: opts.amount * opts.priceUsd + (opts.feeUsd ?? 0),
        amount: opts.amount,
        timeframe_code: "1D",
        trade_datetime: when,   
        strategy_id: chosenStrategyId,
        strategy_rule_match: 0,
        spot_trade: { create: {} },
        notes_entry: "[PORTFOLIO_ADD]",
      },
    })
  },

  async deleteInitPositions(accountId: string, symbol: string) {
    await prisma.journal_entry.deleteMany({
      where: {
        account_id: accountId,
        asset_name: symbol,
        spot_trade: { some: {} },
        notes_entry: "[PORTFOLIO_ADD]",
      },
    })
  },

  async canDeleteInitSymbol(accountId: string, symbol: string): Promise<boolean> {
    if (symbol === "CASH") return false
    const [initCount, journalCount] = await Promise.all([
      prisma.journal_entry.count({
        where: {
          account_id: accountId,
          asset_name: symbol,
          spot_trade: { some: {} },
          notes_entry: "[PORTFOLIO_ADD]",
        },
      }),
      prisma.journal_entry.count({
        where: {
          account_id: accountId,
          asset_name: symbol,
          spot_trade: { some: {} },
          NOT: { notes_entry: "[PORTFOLIO_ADD]" },
        },
      }),
    ])
    return initCount > 0 && journalCount === 0
  },
}
