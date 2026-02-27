import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { cgPriceUsdByIdSafe } from "@/lib/markets/coingecko";
import { calculateKeyLevels } from "@/lib/markets/pivotPoints";
import { migrateLegacyPortfolioTrades } from "@/services/portfolio-legacy-migration.service";

export const dynamic = "force-dynamic";

type DbRow = {
  id: string;
  asset_name: string;
  kind: string;
  qty: unknown;
  price_usd: unknown;
  trade_datetime: Date;
  fee_usd: unknown;
};

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
    symbol = symbolParam.toUpperCase();

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
      },
    })) as DbRow[];

    let qtyHeld = 0;
    let costBasisUsd = 0;
    let totalInvestedUsd = 0;
    let realizedProfitUsd = 0;

    const transactions: Array<{
      id: string;
      side: "buy" | "sell";
      executedAt: string;
      qty: number;
      priceUsd: number;
      totalUsd: number;
      gainLossUsd: number | null;
      gainLossPct: number | null;
    }> = [];

    for (const r of rows) {
      const kind = String(r.kind || "").toLowerCase();
      const side: "buy" | "sell" = kind === "sell" ? "sell" : "buy";

      const qty = Number(r.qty ?? 0);
      const price = Number(r.price_usd ?? 0);
      const fee = Number(r.fee_usd ?? 0) || 0;

      if (!Number.isFinite(qty) || qty <= 0) continue;
      if (!Number.isFinite(price) || price <= 0) continue;

      const totalUsd = qty * price;

      if (side === "buy") {
        qtyHeld += qty;
        costBasisUsd += totalUsd + fee;
        totalInvestedUsd += totalUsd + fee;

        transactions.push({
          id: r.id,
          side: "buy",
          executedAt: r.trade_datetime.toISOString(),
          qty,
          priceUsd: price,
          totalUsd: totalUsd + fee,
          gainLossUsd: null,
          gainLossPct: null,
        });
      } else {
        const avg = qtyHeld > 0 ? costBasisUsd / qtyHeld : 0;
        const gainLossUsd = (price - avg) * qty - fee;
        const gainLossPct = avg > 0 ? ((price - avg) / avg) * 100 : null;

        realizedProfitUsd += gainLossUsd;

        const reduceQty = Math.min(qty, qtyHeld);
        qtyHeld -= reduceQty;
        costBasisUsd -= reduceQty * avg;
        if (qtyHeld < 1e-10) {
          qtyHeld = 0;
          costBasisUsd = 0;
        }

        transactions.push({
          id: r.id,
          side: "sell",
          executedAt: r.trade_datetime.toISOString(),
          qty,
          priceUsd: price,
          totalUsd: totalUsd - fee,
          gainLossUsd: Number.isFinite(gainLossUsd) ? gainLossUsd : null,
          gainLossPct:
            gainLossPct != null && Number.isFinite(gainLossPct)
              ? gainLossPct
              : null,
        });
      }
    }

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
