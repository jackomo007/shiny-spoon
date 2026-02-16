import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  cgCoinMetaByIdSafe,
  cgPriceUsdByIdSafe,
} from "@/lib/markets/coingecko";

export const dynamic = "force-dynamic";

type PriceSource = "coingecko" | "binance" | "avg_entry";
type PriceResult = {
  priceUsd: number;
  source: PriceSource;
  isEstimated: boolean;
  change24hPct: number | null;
};

async function getBinancePriceUsdt(symbol: string): Promise<number> {
  const pair = symbol.endsWith("USDT") ? symbol : `${symbol}USDT`;
  const url = `https://api.binance.com/api/v3/ticker/price?symbol=${encodeURIComponent(pair)}`;
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`Binance HTTP ${res.status}`);
  const j = (await res.json()) as unknown;

  if (typeof j !== "object" || j === null)
    throw new Error("Invalid Binance response");
  const price = (j as { price?: unknown }).price;
  if (typeof price !== "string") throw new Error("Invalid Binance price");

  const p = Number(price);
  if (!Number.isFinite(p) || p <= 0) throw new Error("Invalid Binance price");
  return p;
}

async function resolvePrice(
  symbol: string,
  coingeckoId: string | null,
  avgEntry: number,
): Promise<PriceResult> {
  if (coingeckoId) {
    const cg = await cgPriceUsdByIdSafe(coingeckoId);
    if (cg.ok) {
      return {
        priceUsd: cg.priceUsd,
        source: "coingecko",
        isEstimated: false,
        change24hPct: cg.change24hPct,
      };
    }
  }

  try {
    const p = await getBinancePriceUsdt(symbol);
    return {
      priceUsd: p,
      source: "binance",
      isEstimated: false,
      change24hPct: null,
    };
  } catch {
    // ignore
  }

  const p = Number(avgEntry);
  const safe = Number.isFinite(p) && p > 0 ? p : 0;
  return {
    priceUsd: safe,
    source: "avg_entry",
    isEstimated: true,
    change24hPct: null,
  };
}

type DbRow = {
  id: string;
  asset_name: string;
  side: "buy" | "sell";
  amount: unknown;
  entry_price: unknown;
  trade_datetime: Date;
  buy_fee: unknown;
  sell_fee: unknown;
};

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.accountId)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const accountId = session.accountId;

    const rows = (await prisma.journal_entry.findMany({
      where: {
        account_id: accountId,
        spot_trade: { some: {} },
        asset_name: { not: "CASH" },
        side: { in: ["buy", "sell"] },
      },
      orderBy: { trade_datetime: "asc" },
      select: {
        id: true,
        asset_name: true,
        side: true,
        amount: true,
        entry_price: true,
        trade_datetime: true,
        buy_fee: true,
        sell_fee: true,
      },
    })) as DbRow[];

    const symbols = Array.from(
      new Set(
        rows
          .map((r) =>
            String(r.asset_name || "")
              .trim()
              .toUpperCase(),
          )
          .filter(Boolean),
      ),
    );

    const metas = await prisma.verified_asset.findMany({
      where: { symbol: { in: symbols } },
      select: { symbol: true, name: true, coingecko_id: true, image_url: true },
    });
    const enriched = await Promise.all(
      metas.map(async (m) => {
        const symbol = m.symbol.toUpperCase();
        const coingeckoId = m.coingecko_id ?? null;
        let iconUrl = m.image_url ?? null;
        let name = m.name ?? null;

        if (!iconUrl && coingeckoId) {
          const meta = await cgCoinMetaByIdSafe(coingeckoId);
          if (meta.ok) {
            iconUrl = meta.imageUrl;
            if (!name) name = meta.name || null;

            if (iconUrl) {
              await prisma.verified_asset.update({
                where: { symbol },
                data: { image_url: iconUrl, name },
                select: { id: true },
              });
            }
          }
        }

        return { symbol, name, coingeckoId, iconUrl };
      }),
    );

    const metaBySymbol = new Map(
      enriched.map((m) => [
        m.symbol,
        { name: m.name, coingeckoId: m.coingeckoId, iconUrl: m.iconUrl },
      ]),
    );

    const st = new Map<
      string,
      {
        symbol: string;
        name: string | null;
        coingeckoId: string | null;
        iconUrl: string | null;
        qtyHeld: number;
        costBasisUsd: number;
        totalInvestedUsd: number;
        realizedProfitUsd: number;
      }
    >();

    const txs: Array<{
      id: string;
      side: "buy" | "sell";
      symbol: string;
      name: string | null;
      iconUrl: string | null;
      coingeckoId: string | null;
      executedAt: string;
      qty: number;
      priceUsd: number;
      totalUsd: number;
      gainLossUsd: number | null;
      gainLossPct: number | null;
    }> = [];

    function getState(symbol: string) {
      const s = symbol.toUpperCase();
      const meta = metaBySymbol.get(s) ?? {
        name: null,
        coingeckoId: null,
        iconUrl: null,
      };

      const cur = st.get(s) ?? {
        symbol: s,
        name: meta.name,
        coingeckoId: meta.coingeckoId,
        iconUrl: meta.iconUrl,
        qtyHeld: 0,
        costBasisUsd: 0,
        totalInvestedUsd: 0,
        realizedProfitUsd: 0,
      };

      st.set(s, { ...cur });
      return st.get(s)!;
    }

    for (const r of rows) {
      const symbol = String(r.asset_name || "")
        .trim()
        .toUpperCase();
      if (!symbol) continue;

      const qty = Number(r.amount ?? 0);
      const price = Number(r.entry_price ?? 0);
      const fee = Number(r.side === "buy" ? r.buy_fee : r.sell_fee) || 0;

      if (!Number.isFinite(qty) || qty <= 0) continue;
      if (!Number.isFinite(price) || price <= 0) continue;

      const s = getState(symbol);
      const totalUsd = qty * price;

      if (r.side === "buy") {
        s.qtyHeld += qty;
        s.costBasisUsd += totalUsd + fee;
        s.totalInvestedUsd += totalUsd + fee;

        txs.push({
          id: r.id,
          side: "buy",
          symbol,
          name: s.name,
          iconUrl: s.iconUrl,
          coingeckoId: s.coingeckoId,
          executedAt: r.trade_datetime.toISOString(),
          qty,
          priceUsd: price,
          totalUsd: totalUsd + fee,
          gainLossUsd: null,
          gainLossPct: null,
        });
      } else {
        const avg = s.qtyHeld > 0 ? s.costBasisUsd / s.qtyHeld : 0;
        const gainLossUsd = (price - avg) * qty - fee;
        const gainLossPct = avg > 0 ? ((price - avg) / avg) * 100 : null;

        const reduceQty = Math.min(qty, s.qtyHeld);

        const investedPerUnit =
          s.qtyHeld > 0 ? s.totalInvestedUsd / s.qtyHeld : 0;
        const investedReduced = reduceQty * investedPerUnit;

        s.qtyHeld -= reduceQty;
        s.costBasisUsd -= reduceQty * avg;
        s.totalInvestedUsd -= investedReduced;

        if (Number.isFinite(gainLossUsd)) {
          s.realizedProfitUsd += gainLossUsd;
        }

        if (s.qtyHeld < 1e-10) {
          s.qtyHeld = 0;
          s.costBasisUsd = 0;
          s.totalInvestedUsd = 0;
        }

        txs.push({
          id: r.id,
          side: "sell",
          symbol,
          name: s.name,
          iconUrl: s.iconUrl,
          coingeckoId: s.coingeckoId,
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

    const assetRows = await Promise.all(
      Array.from(st.values()).map(async (g) => {
        const avgEntry =
          g.qtyHeld > 0
            ? g.costBasisUsd / g.qtyHeld
            : g.totalInvestedUsd > 0
              ? g.totalInvestedUsd
              : 0;

        const pr = await resolvePrice(
          g.symbol,
          g.coingeckoId,
          g.qtyHeld > 0 ? avgEntry : 0,
        );

        const holdingsValueUsd = g.qtyHeld * pr.priceUsd;
        const currentProfitUsd = holdingsValueUsd - g.costBasisUsd;
        const currentProfitPct =
          g.costBasisUsd > 0 ? (currentProfitUsd / g.costBasisUsd) * 100 : null;

        return {
          symbol: g.symbol,
          name: g.name,
          coingeckoId: g.coingeckoId,
          iconUrl: g.iconUrl,

          priceUsd: pr.priceUsd,
          change24hPct: pr.change24hPct,
          totalInvestedUsd: g.totalInvestedUsd,
          avgPriceUsd:
            g.qtyHeld > 0
              ? avgEntry
              : g.totalInvestedUsd > 0
                ? g.totalInvestedUsd
                : 0,
          qtyHeld: g.qtyHeld,
          holdingsValueUsd,
          currentProfitUsd,
          currentProfitPct,
          currentPriceSource: pr.source,
          currentPriceIsEstimated: pr.isEstimated,
        };
      }),
    );

    const assetsSorted = assetRows.sort((a, b) => {
      const av = a.holdingsValueUsd ?? 0;
      const bv = b.holdingsValueUsd ?? 0;
      if (bv !== av) return bv - av;
      return (b.totalInvestedUsd ?? 0) - (a.totalInvestedUsd ?? 0);
    });

    const currentBalanceUsd = assetsSorted.reduce(
      (s, a) => s + (a.holdingsValueUsd ?? 0),
      0,
    );
    const totalInvestedUsd = assetsSorted.reduce(
      (s, a) => s + (a.totalInvestedUsd ?? 0),
      0,
    );

    const realizedProfitUsd = Array.from(st.values()).reduce(
      (sum, asset) => sum + (asset.realizedProfitUsd ?? 0),
      0,
    );

    const unrealizedUsd = assetsSorted.reduce(
      (s, a) => s + (a.currentProfitUsd ?? 0),
      0,
    );

    const totalProfitUsd = realizedProfitUsd + unrealizedUsd;
    const totalPct =
      totalInvestedUsd > 0 ? (totalProfitUsd / totalInvestedUsd) * 100 : 0;

    const top =
      assetsSorted.slice().sort((a, b) => {
        const ap = a.currentProfitPct;
        const bp = b.currentProfitPct;
        if (ap != null && bp != null) return bp - ap;
        if (ap != null && bp == null) return -1;
        if (ap == null && bp != null) return 1;
        return (b.currentProfitUsd ?? 0) - (a.currentProfitUsd ?? 0);
      })[0] ?? null;

    return NextResponse.json({
      summary: {
        currentBalanceUsd,
        totalInvestedUsd,
        profit: {
          realized: { usd: realizedProfitUsd },
          unrealized: { usd: unrealizedUsd },
          total: { usd: totalProfitUsd, pct: totalPct },
        },
        portfolio24h: { pct: 0, usd: 0 },
        topPerformer: top
          ? {
              symbol: top.symbol,
              name: top.name ?? null,
              iconUrl: top.iconUrl ?? null,
              coingeckoId: top.coingeckoId ?? null,
              profitUsd: top.currentProfitUsd,
              profitPct: top.currentProfitPct ?? null,
            }
          : null,
      },
      assets: assetsSorted,
      transactions: txs.sort(
        (a, b) => +new Date(b.executedAt) - +new Date(a.executedAt),
      ),
    });
  } catch (e) {
    console.error("[GET /api/portfolio] error:", e);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
