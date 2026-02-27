import { prisma } from "@/lib/prisma";

const migratedAccounts = new Set<string>();

function toNumber(value: unknown): number {
  const n = Number(value ?? 0);
  return Number.isFinite(n) ? n : 0;
}

export async function migrateLegacyPortfolioTrades(
  accountId: string,
): Promise<number> {
  if (!accountId) return 0;
  if (migratedAccounts.has(accountId)) return 0;

  const legacyRows = await prisma.journal_entry.findMany({
    where: {
      account_id: accountId,
      asset_name: { not: "CASH" },
      side: { in: ["buy", "sell"] },
      spot_trade: { some: {} },
      OR: [
        { notes_entry: { startsWith: "[PORTFOLIO_SPOT_TX]" } },
        { notes_entry: "[PORTFOLIO_ADD]" },
        { notes_entry: "[JE:PORTFOLIO]" },
      ],
    },
    select: {
      id: true,
      asset_name: true,
      side: true,
      amount: true,
      entry_price: true,
      trade_datetime: true,
      buy_fee: true,
      sell_fee: true,
      notes_entry: true,
    },
  });

  if (!legacyRows.length) {
    migratedAccounts.add(accountId);
    return 0;
  }

  const migrationNotes = legacyRows.map((r) => `[MIGRATED_JE:${r.id}]`);

  const existing = await prisma.portfolio_trade.findMany({
    where: {
      account_id: accountId,
      note: { in: migrationNotes },
    },
    select: { note: true },
  });

  const existingNoteSet = new Set(existing.map((r) => r.note));

  const toCreate = legacyRows
    .filter((r) => !existingNoteSet.has(`[MIGRATED_JE:${r.id}]`))
    .map((r) => {
      const qty = toNumber(r.amount);
      const priceUsd = toNumber(r.entry_price);
      const feeUsd = toNumber(r.side === "buy" ? r.buy_fee : r.sell_fee);

      if (qty <= 0 || priceUsd <= 0) return null;

      const isInit = r.notes_entry === "[PORTFOLIO_ADD]";
      const kind: "buy" | "sell" | "init" = isInit
        ? "init"
        : r.side === "sell"
          ? "sell"
          : "buy";

      const cashDeltaUsd =
        kind === "sell" ? priceUsd * qty - feeUsd : -(priceUsd * qty + feeUsd);

      return {
        account_id: accountId,
        trade_datetime: r.trade_datetime,
        asset_name: r.asset_name.toUpperCase(),
        kind,
        qty,
        price_usd: priceUsd,
        fee_usd: feeUsd,
        cash_delta_usd: cashDeltaUsd,
        note: `[MIGRATED_JE:${r.id}]`,
      };
    })
    .filter((r): r is NonNullable<typeof r> => r != null);

  if (toCreate.length) {
    await prisma.portfolio_trade.createMany({ data: toCreate });
  }

  migratedAccounts.add(accountId);
  return toCreate.length;
}
