import { prisma } from "@/lib/prisma"

type Side = "buy" | "sell"
type PortfolioKind = "buy" | "sell" | "init"

const TRADE_KINDS: PortfolioKind[] = ["buy", "sell", "init"]

export type SpotTxRow = {
  id: string
  symbol: string
  side: Side
  qty: number
  priceUsd: number
  feeUsd: number
  executedAt: Date
}

export const PortfolioRepoV2 = {
  async listSpotTransactions(accountId: string): Promise<SpotTxRow[]> {
    const rows = await prisma.portfolio_trade.findMany({
      where: {
        account_id: accountId,
        asset_name: { not: "CASH" },
        kind: { in: TRADE_KINDS },
      },
      select: {
        id: true,
        asset_name: true,
        kind: true,
        qty: true,
        price_usd: true,
        fee_usd: true,
        trade_datetime: true,
      },
      orderBy: { trade_datetime: "desc" },
      take: 250,
    })

    return rows.map((r) => {
      const kind = String(r.kind).toLowerCase()
      const side: Side = kind === "sell" ? "sell" : "buy"

      return {
        id: r.id,
        symbol: String(r.asset_name).toUpperCase(),
        side,
        qty: Number(r.qty ?? 0),
        priceUsd: Number(r.price_usd ?? 0),
        feeUsd: Number(r.fee_usd ?? 0) || 0,
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
    const symbol = params.symbol.trim().toUpperCase()
    const qty = Number(params.qty)
    const priceUsd = Number(params.priceUsd)
    const feeUsd = Number(params.feeUsd ?? 0)

    const cashDeltaUsd =
      params.side === "sell"
        ? priceUsd * qty - feeUsd
        : -(priceUsd * qty + feeUsd)

    const row = await prisma.portfolio_trade.create({
      data: {
        account_id: params.accountId,
        trade_datetime: params.executedAt,
        asset_name: symbol,
        kind: params.side,
        qty,
        price_usd: priceUsd,
        fee_usd: feeUsd,
        cash_delta_usd: cashDeltaUsd,
        note: params.notes ?? null,
      },
      select: { id: true },
    })

    return row.id
  },

  async createInitTransaction(params: {
    accountId: string
    symbol: string
    qty: number
    priceUsd: number
    feeUsd?: number
    executedAt: Date
    notes?: string | null
  }) {
    const symbol = params.symbol.trim().toUpperCase()
    const qty = Number(params.qty)
    const priceUsd = Number(params.priceUsd)
    const feeUsd = Number(params.feeUsd ?? 0)

    const row = await prisma.portfolio_trade.create({
      data: {
        account_id: params.accountId,
        trade_datetime: params.executedAt,
        asset_name: symbol,
        kind: "init",
        qty,
        price_usd: priceUsd,
        fee_usd: feeUsd,
        cash_delta_usd: -(priceUsd * qty + feeUsd),
        note: params.notes ?? null,
      },
      select: { id: true },
    })

    return row.id
  },

  async updateSpotTransaction(params: {
    accountId: string
    tradeId: string
    side: Side
    qty: number
    priceUsd: number
    feeUsd?: number
    executedAt?: Date
  }): Promise<boolean> {
    const qty = Number(params.qty)
    const priceUsd = Number(params.priceUsd)
    const feeUsd = Number(params.feeUsd ?? 0)

    const cashDeltaUsd =
      params.side === "sell"
        ? priceUsd * qty - feeUsd
        : -(priceUsd * qty + feeUsd)

    const result = await prisma.portfolio_trade.updateMany({
      where: {
        id: params.tradeId,
        account_id: params.accountId,
        asset_name: { not: "CASH" },
        kind: { in: TRADE_KINDS },
      },
      data: {
        kind: params.side,
        qty,
        price_usd: priceUsd,
        fee_usd: feeUsd,
        cash_delta_usd: cashDeltaUsd,
        ...(params.executedAt ? { trade_datetime: params.executedAt } : {}),
      },
    })

    return result.count > 0
  },

  async deleteSpotTransaction(params: {
    accountId: string
    tradeId: string
  }): Promise<boolean> {
    const result = await prisma.portfolio_trade.deleteMany({
      where: {
        id: params.tradeId,
        account_id: params.accountId,
        asset_name: { not: "CASH" },
        kind: { in: TRADE_KINDS },
      },
    })

    return result.count > 0
  },
}
