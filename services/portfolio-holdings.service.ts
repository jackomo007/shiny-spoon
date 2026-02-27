import { prisma } from "@/lib/prisma";
import { migrateLegacyPortfolioTrades } from "@/services/portfolio-legacy-migration.service";

export type Holding = {
  symbol: string;
  qty: number;
  investedUsd: number;
  avgEntryPriceUsd: number;
};

type TradeRow = {
  asset_name: string;
  kind: string;
  qty: unknown;
  price_usd: unknown;
  fee_usd: unknown;
};

type HoldingState = {
  qty: number;
  investedUsd: number;
};

function applyTrade(state: HoldingState, row: TradeRow): HoldingState {
  const kind = String(row.kind || "").toLowerCase();
  const qty = Number(row.qty ?? 0);
  const priceUsd = Number(row.price_usd ?? 0);
  const feeUsd = Number(row.fee_usd ?? 0) || 0;

  if (!Number.isFinite(qty) || qty <= 0) return state;
  if (!Number.isFinite(priceUsd) || priceUsd <= 0) return state;

  if (kind === "buy" || kind === "init") {
    return {
      qty: state.qty + qty,
      investedUsd: state.investedUsd + qty * priceUsd + feeUsd,
    };
  }

  if (kind === "sell") {
    const avg = state.qty > 0 ? state.investedUsd / state.qty : 0;
    const reduceQty = Math.min(qty, state.qty);
    const nextQty = state.qty - reduceQty;
    const nextInvested = state.investedUsd - reduceQty * avg;

    if (nextQty < 1e-10) {
      return { qty: 0, investedUsd: 0 };
    }

    return {
      qty: nextQty,
      investedUsd: Math.max(nextInvested, 0),
    };
  }

  return state;
}

export async function getOpenSpotHolding(
  accountId: string,
  symbol: string,
): Promise<Holding | null> {
  await migrateLegacyPortfolioTrades(accountId);
  const sym = symbol.trim().toUpperCase();

  const rows = (await prisma.portfolio_trade.findMany({
    where: {
      account_id: accountId,
      asset_name: sym,
      kind: { in: ["buy", "sell", "init"] },
    },
    orderBy: { trade_datetime: "asc" },
    select: {
      asset_name: true,
      kind: true,
      qty: true,
      price_usd: true,
      fee_usd: true,
    },
  })) as TradeRow[];

  if (!rows.length) return null;

  let state: HoldingState = { qty: 0, investedUsd: 0 };
  for (const row of rows) state = applyTrade(state, row);

  if (state.qty <= 0) return null;

  return {
    symbol: sym,
    qty: state.qty,
    investedUsd: state.investedUsd,
    avgEntryPriceUsd: state.investedUsd / state.qty,
  };
}

export async function getOpenSpotHoldings(
  accountId: string,
): Promise<Holding[]> {
  await migrateLegacyPortfolioTrades(accountId);
  const rows = (await prisma.portfolio_trade.findMany({
    where: {
      account_id: accountId,
      asset_name: { not: "CASH" },
      kind: { in: ["buy", "sell", "init"] },
    },
    orderBy: { trade_datetime: "asc" },
    select: {
      asset_name: true,
      kind: true,
      qty: true,
      price_usd: true,
      fee_usd: true,
    },
  })) as TradeRow[];

  if (!rows.length) return [];

  const map = new Map<string, HoldingState>();

  for (const row of rows) {
    const sym = String(row.asset_name || "").trim().toUpperCase();
    if (!sym || sym === "CASH") continue;

    const current = map.get(sym) ?? { qty: 0, investedUsd: 0 };
    map.set(sym, applyTrade(current, row));
  }

  return Array.from(map.entries())
    .filter(([, v]) => v.qty > 0)
    .map(([symbol, v]) => ({
      symbol,
      qty: v.qty,
      investedUsd: v.investedUsd,
      avgEntryPriceUsd: v.investedUsd / v.qty,
    }));
}
