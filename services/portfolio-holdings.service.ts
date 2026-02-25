import { prisma } from "@/lib/prisma";

export type Holding = {
  symbol: string;
  qty: number;
  investedUsd: number;
  avgEntryPriceUsd: number;
};

export async function getOpenSpotHolding(
  accountId: string,
  symbol: string,
): Promise<Holding | null> {
  const sym = symbol.trim().toUpperCase();

  const rows = await prisma.journal_entry.findMany({
    where: {
      account_id: accountId,
      spot_trade: { some: {} },
      status: "in_progress",
      side: "buy",
      asset_name: sym,
    },
    select: { amount: true, entry_price: true },
  });

  if (!rows.length) return null;

  let qty = 0;
  let investedUsd = 0;

  for (const r of rows) {
    const a = Number(r.amount ?? 0);
    const p = Number(r.entry_price ?? 0);
    if (a <= 0 || p <= 0) continue;
    qty += a;
    investedUsd += a * p;
  }

  if (qty <= 0) return null;

  return {
    symbol: sym,
    qty,
    investedUsd,
    avgEntryPriceUsd: investedUsd / qty,
  };
}

export async function getOpenSpotHoldings(
  accountId: string,
): Promise<Holding[]> {
  const rows = await prisma.journal_entry.findMany({
    where: {
      account_id: accountId,
      spot_trade: { some: {} },
      status: "in_progress",
      side: "buy",
    },
    select: { asset_name: true, amount: true, entry_price: true },
  });

  if (!rows.length) return [];

  const map = new Map<string, { qty: number; investedUsd: number }>();

  for (const r of rows) {
    const sym = r.asset_name.trim().toUpperCase();
    const a = Number(r.amount ?? 0);
    const p = Number(r.entry_price ?? 0);
    if (a <= 0 || p <= 0) continue;

    const existing = map.get(sym) ?? { qty: 0, investedUsd: 0 };
    map.set(sym, {
      qty: existing.qty + a,
      investedUsd: existing.investedUsd + a * p,
    });
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
