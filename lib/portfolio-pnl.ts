export type PortfolioPnlTrade = {
  id?: string;
  symbol?: string;
  executedAt?: Date;
  kind: string;
  qty: unknown;
  priceUsd: unknown;
  feeUsd?: unknown;
};

export type PortfolioPnlTransaction = {
  id?: string;
  symbol?: string;
  executedAt?: Date;
  side: "buy" | "sell";
  qty: number;
  priceUsd: number;
  feeUsd: number;
  totalUsd: number;
  realizedPnlUsd: number | null;
  realizedPnlPct: number | null;
};

export type PortfolioPnlState = {
  qtyHeld: number;
  costBasisUsd: number;
  totalInvestedUsd: number;
  realizedPnlUsd: number;
  transactions: PortfolioPnlTransaction[];
};

export function calculatePortfolioPnl(
  trades: PortfolioPnlTrade[],
): PortfolioPnlState {
  let qtyHeld = 0;
  let costBasisUsd = 0;
  let totalInvestedUsd = 0;
  let realizedPnlUsd = 0;
  const transactions: PortfolioPnlTransaction[] = [];

  for (const trade of trades) {
    const kind = String(trade.kind || "").toLowerCase();
    const side: "buy" | "sell" = kind === "sell" ? "sell" : "buy";
    const qty = Number(trade.qty ?? 0);
    const priceUsd = Number(trade.priceUsd ?? 0);
    const feeUsd = Number(trade.feeUsd ?? 0) || 0;

    if (!Number.isFinite(qty) || qty <= 0) continue;
    if (!Number.isFinite(priceUsd) || priceUsd <= 0) continue;

    const grossValueUsd = qty * priceUsd;

    if (side === "buy") {
      const totalUsd = grossValueUsd + feeUsd;
      qtyHeld += qty;
      costBasisUsd += totalUsd;
      totalInvestedUsd += totalUsd;

      transactions.push({
        id: trade.id,
        symbol: trade.symbol,
        executedAt: trade.executedAt,
        side,
        qty,
        priceUsd,
        feeUsd,
        totalUsd,
        realizedPnlUsd: null,
        realizedPnlPct: null,
      });
      continue;
    }

    const avgCostUsd = qtyHeld > 0 ? costBasisUsd / qtyHeld : 0;
    const reduceQty = Math.min(qty, qtyHeld);
    const costRemovedUsd = reduceQty * avgCostUsd;
    const saleProceedsUsd = grossValueUsd - feeUsd;
    const pnlUsd = saleProceedsUsd - costRemovedUsd;
    const pnlPct = costRemovedUsd > 0 ? (pnlUsd / costRemovedUsd) * 100 : null;

    totalInvestedUsd -= saleProceedsUsd;
    realizedPnlUsd += pnlUsd;
    qtyHeld -= reduceQty;
    costBasisUsd -= costRemovedUsd;

    if (qtyHeld < 1e-10) {
      qtyHeld = 0;
      costBasisUsd = 0;
    }

    transactions.push({
      id: trade.id,
      symbol: trade.symbol,
      executedAt: trade.executedAt,
      side,
      qty,
      priceUsd,
      feeUsd,
      totalUsd: saleProceedsUsd,
      realizedPnlUsd: pnlUsd,
      realizedPnlPct: pnlPct,
    });
  }

  return {
    qtyHeld,
    costBasisUsd,
    totalInvestedUsd,
    realizedPnlUsd,
    transactions,
  };
}
