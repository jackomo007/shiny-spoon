import { NextResponse } from "next/server";
import { z } from "zod";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { PortfolioRepoV2 } from "@/data/repositories/portfolio.repo.v2";
import { prisma } from "@/lib/prisma";
import {
  cgNormalizeOrResolveCoinId,
  cgPriceUsdById,
  cgCoinMetaByIdSafe,
} from "@/lib/markets/coingecko";
import {
  deleteAssetExitStrategiesIfNoHolding,
  ensureDefaultExitStrategyForAsset,
} from "@/services/exit-strategy.service";
import { getOpenSpotHolding } from "@/services/portfolio-holdings.service";
import {
  setPortfolioAssetHidden,
  setPortfolioAssetStablecoin,
} from "@/services/portfolio-asset-settings.service";
import {
  getDefaultPortfolioChainId,
  normalizePortfolioChainId,
} from "@/lib/portfolio-chains";

export const dynamic = "force-dynamic";

const STABLECOIN_SYMBOLS = new Set(["USDT", "USDC", "DAI", "TUSD", "USDP"]);

const Body = z.object({
  asset: z.object({
    id: z.string().min(1),
    symbol: z.string().min(1),
    name: z.string().optional().nullable(),
  }),
  side: z.enum(["buy", "sell"]).default("buy"),
  priceMode: z.enum(["market", "custom"]).default("market"),
  priceUsd: z.number().positive().optional(),
  qty: z.number().positive().optional(),
  totalUsd: z.number().positive().optional(),
  feeUsd: z.number().min(0).optional(),
  chainId: z.string().min(1).optional().nullable(),
  isStablecoin: z.boolean().optional(),
  executedAt: z.string().datetime().optional(),
  convertProceeds: z
    .object({
      enabled: z.boolean().default(false),
      asset: z.object({
        id: z.string().min(1),
        symbol: z.string().min(1),
        name: z.string().optional().nullable(),
      }),
    })
    .optional(),
});

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.accountId)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const input = Body.parse(await req.json());

    const symbol = input.asset.symbol.trim().toUpperCase();
    const chainId =
      normalizePortfolioChainId(input.chainId) ??
      getDefaultPortfolioChainId(symbol);
    const executedAt = input.executedAt
      ? new Date(input.executedAt)
      : new Date();
    const existingHolding = await getOpenSpotHolding(session.accountId, symbol);

    const existingAsset = await prisma.verified_asset.findUnique({
      where: { symbol },
      select: { coingecko_id: true, name: true, image_url: true },
    });

    const coingeckoId =
      existingAsset?.coingecko_id ??
      (await cgNormalizeOrResolveCoinId({
        assetId: input.asset.id,
        assetSymbol: symbol,
      }));

    let priceUsd: number;
    let change24hPct: number | null = null;

    if (input.priceMode === "market") {
      if (!coingeckoId) {
        return NextResponse.json(
          { error: `Could not resolve CoinGecko id for ${symbol}.` },
          { status: 400 },
        );
      }
      const m = await cgPriceUsdById(coingeckoId);
      priceUsd = m.priceUsd;
      change24hPct = m.change24hPct;
    } else {
      if (input.priceUsd == null) {
        return NextResponse.json(
          { error: "Missing custom priceUsd" },
          { status: 400 },
        );
      }
      priceUsd = input.priceUsd;
    }

    const feeUsd = input.feeUsd ?? 0;
    let qty = input.qty ?? null;
    let totalUsd = input.totalUsd ?? null;

    if (qty == null && totalUsd == null) {
      return NextResponse.json(
        { error: "Provide qty or totalUsd" },
        { status: 400 },
      );
    }
    if (qty == null && totalUsd != null) {
      if (!Number.isFinite(totalUsd) || totalUsd <= 0) {
        return NextResponse.json(
          { error: "Invalid totalUsd" },
          { status: 400 },
        );
      }
      qty = totalUsd / priceUsd;
    }
    if (totalUsd == null && qty != null) {
      totalUsd = qty * priceUsd;
    }

    if (!qty || !Number.isFinite(qty) || qty <= 0) {
      return NextResponse.json({ error: "Invalid qty" }, { status: 400 });
    }

    let imageUrl: string | null = existingAsset?.image_url ?? null;
    let name: string | null =
      (input.asset.name ?? null) && String(input.asset.name).trim()
        ? String(input.asset.name).trim()
        : (existingAsset?.name ?? null);

    if (coingeckoId && (!imageUrl || !name)) {
      const meta = await cgCoinMetaByIdSafe(coingeckoId);
      if (meta.ok) {
        imageUrl = imageUrl ?? meta.imageUrl;
        if (!name) name = meta.name || null;
      }
    }

    await prisma.verified_asset.upsert({
      where: { symbol },
      update: {
        name: name ?? undefined,
        coingecko_id: coingeckoId ?? undefined,
        image_url: imageUrl ?? undefined,
      },
      create: {
        symbol,
        name,
        exchange: "Binance",
        coingecko_id: coingeckoId,
        image_url: imageUrl,
      },
      select: { id: true },
    });

    if (input.isStablecoin != null && !existingHolding) {
      await setPortfolioAssetStablecoin({
        accountId: session.accountId,
        symbol,
        isStablecoin: input.isStablecoin,
      });
    }

    await setPortfolioAssetHidden({
      accountId: session.accountId,
      symbol,
      isHidden: false,
    });

    await PortfolioRepoV2.createSpotTransaction({
      accountId: session.accountId,
      symbol,
      side: input.side,
      qty,
      priceUsd,
      feeUsd,
      chainId,
      executedAt,
      notes: `[PORTFOLIO_SPOT_TX] cg:${coingeckoId ?? "unresolved"} chain:${chainId} chg24h:${change24hPct ?? "n/a"}`,
    });

    if (input.side === "sell" && input.convertProceeds?.enabled) {
      const receiveSymbol = input.convertProceeds.asset.symbol
        .trim()
        .toUpperCase();
      if (!receiveSymbol || receiveSymbol === symbol) {
        return NextResponse.json(
          { error: "Select a different asset to receive." },
          { status: 400 },
        );
      }
      const receiveExistingHolding = await getOpenSpotHolding(
        session.accountId,
        receiveSymbol,
      );
      const receiveExistingAsset = await prisma.verified_asset.findUnique({
        where: { symbol: receiveSymbol },
        select: { coingecko_id: true, name: true, image_url: true },
      });
      const receiveCoingeckoId =
        receiveExistingAsset?.coingecko_id ??
        (await cgNormalizeOrResolveCoinId({
          assetId: input.convertProceeds.asset.id,
          assetSymbol: receiveSymbol,
        }));

      const receiveIsStablecoin = STABLECOIN_SYMBOLS.has(receiveSymbol);
      let receivePriceUsd = receiveIsStablecoin ? 1 : 0;
      let receiveChange24hPct: number | null = null;
      if (!receiveIsStablecoin && receiveCoingeckoId) {
        const receivePrice = await cgPriceUsdById(receiveCoingeckoId);
        receivePriceUsd = receivePrice.priceUsd;
        receiveChange24hPct = receivePrice.change24hPct;
      }
      if (!Number.isFinite(receivePriceUsd) || receivePriceUsd <= 0) {
        return NextResponse.json(
          { error: `Could not resolve market price for ${receiveSymbol}.` },
          { status: 400 },
        );
      }

      let receiveImageUrl: string | null =
        receiveExistingAsset?.image_url ?? null;
      let receiveName: string | null =
        (input.convertProceeds.asset.name ?? null) &&
        String(input.convertProceeds.asset.name).trim()
          ? String(input.convertProceeds.asset.name).trim()
          : (receiveExistingAsset?.name ?? null);

      if (receiveCoingeckoId && (!receiveImageUrl || !receiveName)) {
        const receiveMeta = await cgCoinMetaByIdSafe(receiveCoingeckoId);
        if (receiveMeta.ok) {
          receiveImageUrl = receiveImageUrl ?? receiveMeta.imageUrl;
          if (!receiveName) receiveName = receiveMeta.name || null;
        }
      }

      await prisma.verified_asset.upsert({
        where: { symbol: receiveSymbol },
        update: {
          name: receiveName ?? undefined,
          coingecko_id: receiveCoingeckoId ?? undefined,
          image_url: receiveImageUrl ?? undefined,
        },
        create: {
          symbol: receiveSymbol,
          name: receiveName,
          exchange: "Binance",
          coingecko_id: receiveCoingeckoId,
          image_url: receiveImageUrl,
        },
        select: { id: true },
      });

      if (receiveIsStablecoin && !receiveExistingHolding) {
        await setPortfolioAssetStablecoin({
          accountId: session.accountId,
          symbol: receiveSymbol,
          isStablecoin: true,
        });
      }
      await setPortfolioAssetHidden({
        accountId: session.accountId,
        symbol: receiveSymbol,
        isHidden: false,
      });

      const netProceedsUsd = qty * priceUsd - feeUsd;
      if (netProceedsUsd > 0) {
        await PortfolioRepoV2.createSpotTransaction({
          accountId: session.accountId,
          symbol: receiveSymbol,
          side: "buy",
          qty: netProceedsUsd / receivePriceUsd,
          priceUsd: receivePriceUsd,
          feeUsd: 0,
          chainId: getDefaultPortfolioChainId(receiveSymbol),
          executedAt,
          notes: `[PORTFOLIO_SELL_CONVERT] from:${symbol} cg:${receiveCoingeckoId ?? "unresolved"} chg24h:${receiveChange24hPct ?? "n/a"}`,
        });

        if (!receiveExistingHolding && !receiveIsStablecoin) {
          await ensureDefaultExitStrategyForAsset(
            session.accountId,
            receiveSymbol,
          );
        }
      }
    }

    if (!existingHolding) {
      const holding = await getOpenSpotHolding(session.accountId, symbol);
      if (holding) {
        await ensureDefaultExitStrategyForAsset(session.accountId, symbol);
      }
    }

    await deleteAssetExitStrategiesIfNoHolding(session.accountId, symbol);

    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.flatten() }, { status: 400 });
    }
    console.error("[POST /api/portfolio/add-transaction] error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
