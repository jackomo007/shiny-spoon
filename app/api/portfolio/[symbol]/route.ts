import { NextResponse } from "next/server";
import { z } from "zod";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { cgPriceUsdByIdSafe } from "@/lib/markets/coingecko";
import { calculateKeyLevels } from "@/lib/markets/pivotPoints";
import { migrateLegacyPortfolioTrades } from "@/services/portfolio-legacy-migration.service";
import { calculatePortfolioPnl } from "@/lib/portfolio-pnl";
import { deleteAssetExitStrategiesIfNoHolding } from "@/services/exit-strategy.service";
import { setPortfolioAssetHidden } from "@/services/portfolio-asset-settings.service";

export const dynamic = "force-dynamic";

type DbRow = {
  id: string;
  asset_name: string;
  kind: string;
  qty: unknown;
  price_usd: unknown;
  trade_datetime: Date;
  fee_usd: unknown;
  chain_id: string | null;
};

const DeleteBody = z.object({
  mode: z.enum(["keepHistory", "deleteHistory"]).default("keepHistory"),
});

function symbolFromParam(symbol: string) {
  return decodeURIComponent(symbol).trim().toUpperCase();
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ symbol: string }> },
) {
  let symbol = "[unknown]";
  try {
    const session = await getServerSession(authOptions);
    if (!session?.accountId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const accountId = session.accountId;
    await migrateLegacyPortfolioTrades(accountId);
    const { symbol: symbolParam } = await params;
    symbol = symbolFromParam(symbolParam);

    const assetMeta = await prisma.verified_asset.findUnique({
      where: { symbol },
      select: {
        symbol: true,
        name: true,
        coingecko_id: true,
        image_url: true,
      },
    });

    if (!assetMeta) {
      return NextResponse.json({ error: "Asset not found" }, { status: 404 });
    }

    const rows = (await prisma.portfolio_trade.findMany({
      where: {
        account_id: accountId,
        asset_name: symbol,
        kind: { in: ["buy", "sell", "init"] },
      },
      orderBy: { trade_datetime: "asc" },
      select: {
        id: true,
        asset_name: true,
        kind: true,
        qty: true,
        price_usd: true,
        trade_datetime: true,
        fee_usd: true,
        chain_id: true,
      },
    })) as DbRow[];

    const transactions: Array<{
      id: string;
      side: "buy" | "sell";
      chainId: string | null;
      executedAt: string;
      qty: number;
      priceUsd: number;
      totalUsd: number;
      feeUsd: number;
      gainLossUsd: number | null;
      gainLossPct: number | null;
    }> = [];

    const pnl = calculatePortfolioPnl(
      rows.map((r) => ({
        id: r.id,
        executedAt: r.trade_datetime,
        kind: r.kind,
        qty: r.qty,
        priceUsd: r.price_usd,
        feeUsd: r.fee_usd,
      })),
    );

    for (const tx of pnl.transactions) {
      transactions.push({
        id: tx.id ?? "",
        side: tx.side,
        chainId: rows.find((row) => row.id === tx.id)?.chain_id ?? null,
        executedAt: tx.executedAt?.toISOString() ?? new Date(0).toISOString(),
        qty: tx.qty,
        priceUsd: tx.priceUsd,
        totalUsd: tx.totalUsd,
        feeUsd: tx.feeUsd,
        gainLossUsd: tx.realizedPnlUsd,
        gainLossPct: tx.realizedPnlPct,
      });
    }

    const qtyHeld = pnl.qtyHeld;
    const costBasisUsd = pnl.costBasisUsd;
    const totalInvestedUsd = pnl.totalInvestedUsd;
    const realizedProfitUsd = pnl.realizedPnlUsd;

    let currentPrice = 0;
    let change24hPct: number | null = null;

    if (assetMeta.coingecko_id) {
      const cg = await cgPriceUsdByIdSafe(assetMeta.coingecko_id);
      if (cg.ok) {
        currentPrice = cg.priceUsd;
        change24hPct = cg.change24hPct ?? null;
      }
    }

    if (currentPrice === 0 && qtyHeld > 0 && costBasisUsd > 0) {
      currentPrice = costBasisUsd / qtyHeld;
    }

    const holdingsValueUsd = qtyHeld * currentPrice;
    const unrealizedProfitUsd = holdingsValueUsd - costBasisUsd;
    const totalProfitUsd = realizedProfitUsd + unrealizedProfitUsd;
    const totalProfitPct =
      totalInvestedUsd > 0 ? (totalProfitUsd / totalInvestedUsd) * 100 : 0;

    const avgBuyPrice = qtyHeld > 0 ? costBasisUsd / qtyHeld : 0;

    const keyLevels = await calculateKeyLevels(
      assetMeta.coingecko_id,
      currentPrice,
    );

    return NextResponse.json({
      symbol,
      name: assetMeta.name,
      iconUrl: assetMeta.image_url,

      balance: {
        quantity: qtyHeld,
        valueUsd: holdingsValueUsd,
      },

      metrics: {
        currentPrice,
        change24h: {
          usd: change24hPct ? (currentPrice * change24hPct) / 100 : 0,
          pct: change24hPct,
        },
        totalProfit: {
          usd: totalProfitUsd,
          pct: totalProfitPct,
        },
        realizedProfit: realizedProfitUsd,
        unrealizedProfit: unrealizedProfitUsd,
        avgBuyPrice,
        totalInvested: totalInvestedUsd,
      },

      keyLevels: keyLevels,

      transactions: transactions.reverse(),
    });
  } catch (e) {
    console.error(`[GET /api/portfolio/${symbol}] error:`, e);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ symbol: string }> },
) {
  let symbol = "[unknown]";
  try {
    const session = await getServerSession(authOptions);
    if (!session?.accountId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const accountId = session.accountId;
    await migrateLegacyPortfolioTrades(accountId);
    const { symbol: symbolParam } = await params;
    symbol = symbolFromParam(symbolParam);
    if (!symbol || symbol === "CASH") {
      return NextResponse.json({ error: "Asset not found" }, { status: 404 });
    }

    const body = DeleteBody.parse(await req.json().catch(() => ({})));

    if (body.mode === "deleteHistory") {
      const result = await prisma.portfolio_trade.deleteMany({
        where: {
          account_id: accountId,
          asset_name: symbol,
          kind: { in: ["buy", "sell", "init"] },
        },
      });

      await prisma.portfolio_asset_setting.deleteMany({
        where: { account_id: accountId, asset_symbol: symbol },
      });
      await deleteAssetExitStrategiesIfNoHolding(accountId, symbol);

      return NextResponse.json({ ok: true, deletedTransactions: result.count });
    }

    const rows = (await prisma.portfolio_trade.findMany({
      where: {
        account_id: accountId,
        asset_name: symbol,
        kind: { in: ["buy", "sell", "init"] },
      },
      orderBy: { trade_datetime: "asc" },
      select: {
        id: true,
        asset_name: true,
        kind: true,
        qty: true,
        price_usd: true,
        trade_datetime: true,
        fee_usd: true,
        chain_id: true,
      },
    })) as DbRow[];

    if (!rows.length) {
      return NextResponse.json({ error: "Asset not found" }, { status: 404 });
    }

    await setPortfolioAssetHidden({ accountId, symbol, isHidden: true });
    await deleteAssetExitStrategiesIfNoHolding(accountId, symbol);

    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.flatten() }, { status: 400 });
    }
    console.error(`[DELETE /api/portfolio/${symbol}] error:`, err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
