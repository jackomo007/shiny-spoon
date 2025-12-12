import "server-only";
import { prisma } from "@/lib/prisma";
import { fetchKlines } from "@/lib/klines";
import { buildPriceStructurePrompt } from "@/lib/prompts/price-structure";
import { analyzePriceStructure } from "@/lib/ai-analyzer";
import { recordAiUsage } from "@/lib/ai-usage";
import type { coin_price_structure } from "@prisma/client";

export type PriceLevel = {
  level: number;
  kind: "support" | "resistance";
  label?: string;
  confidence?: number;
  notes?: string;
};

export type PriceStructurePayload = {
  supports: PriceLevel[];
  resistances: PriceLevel[];
};

export type NextLevel = PriceLevel | null;

const HTF_TIMEFRAME = "1D";
const HIT_TOLERANCE_PCT = 0.001; // 0.1%

async function getCurrentPrice(symbol: string): Promise<number> {
  const candles = await fetchKlines(symbol.toUpperCase(), "1d", 2);
  const last = candles[candles.length - 1];
  return last.close;
}

function parseLevels(raw: string): PriceStructurePayload {
  try {
    const parsed = JSON.parse(raw) as PriceStructurePayload;
    return {
      supports: parsed.supports ?? [],
      resistances: parsed.resistances ?? [],
    };
  } catch {
    return { supports: [], resistances: [] };
  }
}

function computeNextLevels(
  struct: PriceStructurePayload,
  price: number,
): {
  nextSupport: NextLevel;
  nextResistance: NextLevel;
} {
  const supportsSorted = [...struct.supports]
    .filter((s) => s.level < price)
    .sort((a, b) => b.level - a.level);

  const resistancesSorted = [...struct.resistances]
    .filter((r) => r.level > price)
    .sort((a, b) => a.level - b.level);

  const nextSupport = supportsSorted[0] ?? null;
  const nextResistance = resistancesSorted[0] ?? null;

  return { nextSupport, nextResistance };
}

function findClosestLevel(
  struct: PriceStructurePayload,
  price: number,
): PriceLevel | null {
  const all = [...struct.supports, ...struct.resistances];
  if (all.length === 0) return null;

  let best = all[0];
  let bestDiff = Math.abs(all[0].level - price);

  for (let i = 1; i < all.length; i += 1) {
    const diff = Math.abs(all[i].level - price);
    if (diff < bestDiff) {
      bestDiff = diff;
      best = all[i];
    }
  }

  return best;
}

function priceHitLevel(price: number, level: number): boolean {
  if (level <= 0) return false;
  const pct = Math.abs(price - level) / level;
  return pct <= HIT_TOLERANCE_PCT;
}

export async function upsertPriceStructureForCoin(opts: {
  accountId: string;
  assetSymbol: string;
  exchange?: string;
}): Promise<{
  id: string;
  asset_symbol: string;
  exchange: string;
  timeframe: string;
  last_price: number;
  last_price_at: Date;
  nextSupport: NextLevel;
  nextResistance: NextLevel;
  usedCache: boolean;
}> {
  const assetSymbol = opts.assetSymbol.toUpperCase();
  const exchange = opts.exchange ?? "Binance";

  // Não exigimos mais que esteja em verified_asset.
  // Apenas buscamos o preço atual no provider.
  const currentPrice = await getCurrentPrice(assetSymbol);

  const existing = await prisma.coin_price_structure.findFirst({
    where: {
      account_id: opts.accountId,
      asset_symbol: assetSymbol,
      exchange,
      timeframe: HTF_TIMEFRAME,
    },
  });

  let struct: PriceStructurePayload | null = null;
  let shouldCallAI = true;

  if (existing) {
    const parsed = parseLevels(existing.levels_json);
    struct = parsed;

    const closest = findClosestLevel(parsed, Number(existing.last_price));
    if (closest) {
      const hit = priceHitLevel(currentPrice, closest.level);
      // Regra: se o preço AINDA NÃO bateu o nível mais próximo, usamos cache.
      if (!hit) {
        shouldCallAI = false;
      }
    }
  }

  if (!struct) {
    struct = { supports: [], resistances: [] };
  }

  if (shouldCallAI) {
    const prompt = await buildPriceStructurePrompt({
      asset: assetSymbol,
      timeframe: HTF_TIMEFRAME,
      lastPrice: currentPrice,
    });

    const { json, model, usage } = await analyzePriceStructure({
      asset: assetSymbol,
      timeframe: HTF_TIMEFRAME,
      lastPrice: currentPrice,
      prompt,
    });

    const payload = json as PriceStructurePayload;

    struct = {
      supports: payload.supports ?? [],
      resistances: payload.resistances ?? [],
    };

    const levelsJson = JSON.stringify(struct);

    await recordAiUsage({
      kind: "structure",
      model,
      inputTokens: usage.input,
      outputTokens: usage.output,
      accountId: null,
      trackerId: null,
      preAnalysisId: null,
      meta: { asset: assetSymbol, timeframe: HTF_TIMEFRAME },
    });

    const row = await prisma.coin_price_structure.upsert({
      where: {
        account_id_asset_symbol_exchange_timeframe: {
          account_id: opts.accountId,
          asset_symbol: assetSymbol,
          exchange,
          timeframe: HTF_TIMEFRAME,
        },
      },
      create: {
        account_id: opts.accountId,
        asset_symbol: assetSymbol,
        exchange,
        timeframe: HTF_TIMEFRAME,
        levels_json: levelsJson,
        last_price: currentPrice,
        last_price_at: new Date(),
      },
      update: {
        levels_json: levelsJson,
        last_price: currentPrice,
        last_price_at: new Date(),
      },
    });

    const { nextSupport, nextResistance } = computeNextLevels(struct, currentPrice);

    return {
      id: row.id,
      asset_symbol: row.asset_symbol,
      exchange: row.exchange,
      timeframe: row.timeframe,
      last_price: Number(row.last_price),
      last_price_at: row.last_price_at,
      nextSupport,
      nextResistance,
      usedCache: false,
    };
  }

  // Usar cache: apenas atualiza last_price e last_price_at
  const updated = await prisma.coin_price_structure.update({
    where: { id: existing!.id },
    data: {
      last_price: currentPrice,
      last_price_at: new Date(),
    },
  });

  const { nextSupport, nextResistance } = computeNextLevels(struct, currentPrice);

  return {
    id: updated.id,
    asset_symbol: updated.asset_symbol,
    exchange: updated.exchange,
    timeframe: updated.timeframe,
    last_price: Number(updated.last_price),
    last_price_at: updated.last_price_at,
    nextSupport,
    nextResistance,
    usedCache: true,
  };
}

export async function listPriceStructuresForAccount(
  accountId: string,
): Promise<
  Array<{
    id: string;
    asset_symbol: string;
    exchange: string;
    timeframe: string;
    last_price: number;
    last_price_at: Date;
    nextSupport: NextLevel;
    nextResistance: NextLevel;
  }>
> {
  const rows: coin_price_structure[] = await prisma.coin_price_structure.findMany({
    where: { account_id: accountId },
    orderBy: { updated_at: "desc" },
  });

  return rows.map((row: coin_price_structure) => {
    const struct = parseLevels(row.levels_json);
    const price = Number(row.last_price);
    const { nextSupport, nextResistance } = computeNextLevels(struct, price);

    return {
      id: row.id,
      asset_symbol: row.asset_symbol,
      exchange: row.exchange,
      timeframe: row.timeframe,
      last_price: price,
      last_price_at: row.last_price_at,
      nextSupport,
      nextResistance,
    };
  });
}

export async function getPriceStructureDetail(opts: {
  id: string;
  accountId: string;
}): Promise<{
  id: string;
  asset_symbol: string;
  exchange: string;
  timeframe: string;
  last_price: number;
  last_price_at: Date;
  structure: PriceStructurePayload;
} | null> {
  const row = await prisma.coin_price_structure.findFirst({
    where: { id: opts.id, account_id: opts.accountId },
  });

  if (!row) return null;

  const struct = parseLevels(row.levels_json);

  return {
    id: row.id,
    asset_symbol: row.asset_symbol,
    exchange: row.exchange,
    timeframe: row.timeframe,
    last_price: Number(row.last_price),
    last_price_at: row.last_price_at,
    structure: struct,
  };
}
