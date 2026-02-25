import { NextResponse } from "next/server";
import { z } from "zod";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import {
  getOpenSpotHolding,
  getOpenSpotHoldings,
} from "@/services/portfolio-holdings.service";

export const dynamic = "force-dynamic";

const Body = z.union([
  z.object({
    allCoins: z.literal(true),
    sellPercent: z.number().positive().max(100),
    gainPercent: z.number().positive().max(10_000),
    maxSteps: z.number().int().positive().max(50).optional(),
  }),
  z.object({
    allCoins: z.literal(false),
    coinSymbols: z.array(z.string().min(1)).min(1),
    sellPercent: z.number().positive().max(100),
    gainPercent: z.number().positive().max(10_000),
    maxSteps: z.number().int().positive().max(50).optional(),
  }),
]);

type SimRow = {
  gainPercent: number;
  targetPriceUsd: number;
  plannedQtyToSell: number;
  executedQtyToSell: null;
  proceedsUsd: number;
  remainingQtyAfter: number;
  realizedProfitUsd: number;
  cumulativeRealizedProfitUsd: number;
  isExecuted: false;
};

type CoinSimResult = {
  coinSymbol: string;
  qtyOpen: number;
  entryPriceUsd: number;
  rows: SimRow[];
};

function round(n: number, digits: number): number {
  const p = 10 ** digits;
  return Math.round(n * p) / p;
}

function simulateCoin(
  coin: string,
  qtyOpen: number,
  entryPriceUsd: number,
  sellPct: number,
  gainStep: number,
  maxSteps: number,
): CoinSimResult {
  let remaining = qtyOpen;
  let cumulative = 0;
  const rows: SimRow[] = [];

  for (let i = 1; i <= maxSteps; i++) {
    const gain = round(gainStep * i, 2);
    const target = entryPriceUsd > 0 ? entryPriceUsd * (1 + gain / 100) : 0;
    const qtySoldNow = remaining > 0 ? remaining * sellPct : 0;
    const proceeds = qtySoldNow * target;
    const profit = qtySoldNow * (target - entryPriceUsd);

    remaining = Math.max(0, remaining - qtySoldNow);
    cumulative += profit;

    rows.push({
      gainPercent: gain,
      targetPriceUsd: round(target, 8),
      plannedQtyToSell: round(qtySoldNow, 8),
      executedQtyToSell: null,
      proceedsUsd: round(proceeds, 2),
      remainingQtyAfter: round(remaining, 8),
      realizedProfitUsd: round(profit, 2),
      cumulativeRealizedProfitUsd: round(cumulative, 2),
      isExecuted: false,
    });

    if (remaining <= 0) break;
  }

  return {
    coinSymbol: coin,
    qtyOpen: round(qtyOpen, 8),
    entryPriceUsd: round(entryPriceUsd, 8),
    rows,
  };
}

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.accountId)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const accountId = session.accountId;
    const body = Body.parse(await req.json());

    const sellPct = body.sellPercent / 100;
    const gainStep = body.gainPercent;
    const maxSteps = body.maxSteps ?? 10;

    const holdings =
      body.allCoins === true
        ? await getOpenSpotHoldings(accountId)
        : await Promise.all(
            body.coinSymbols.map((c) =>
              getOpenSpotHolding(accountId, c.trim().toUpperCase()),
            ),
          ).then((results) =>
            results.flatMap((h, i) =>
              h
                ? [h]
                : [
                    {
                      symbol: body.coinSymbols[i]!.trim().toUpperCase(),
                      qty: 0,
                      investedUsd: 0,
                      avgEntryPriceUsd: 0,
                    },
                  ],
            ),
          );

    const results: CoinSimResult[] = holdings.map((h) =>
      simulateCoin(
        h.symbol,
        h.qty,
        h.avgEntryPriceUsd,
        sellPct,
        gainStep,
        maxSteps,
      ),
    );

    return NextResponse.json({ data: { results } });
  } catch (err: unknown) {
    if (err instanceof z.ZodError)
      return NextResponse.json({ error: err.flatten() }, { status: 400 });
    console.error("[POST /api/exit-strategies/simulate] error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
