import { NextResponse } from "next/server";
import { z } from "zod";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { buildExitStrategyDetails } from "@/services/exit-strategy.service";
import { getOpenSpotHolding } from "@/services/portfolio-holdings.service";

export const dynamic = "force-dynamic";

const Body = z.object({
  coinSymbol: z.string().min(1).optional(),
  stepGainPercent: z.number().positive(),
  targetPriceUsd: z.number().positive(),
  executedPriceUsd: z.number().positive(),
  quantitySold: z.number().positive(),
});

export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await ctx.params;

    const session = await getServerSession(authOptions);
    if (!session?.accountId)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const accountId = session.accountId;
    const data = Body.parse(await req.json());

    const strategy = await prisma.exit_strategy.findFirst({
      where: { id, account_id: accountId },
      select: { id: true, coin_symbol: true, is_all_coins: true },
    });
    if (!strategy)
      return NextResponse.json({ error: "Not found" }, { status: 404 });

    if (strategy.is_all_coins && !data.coinSymbol) {
      return NextResponse.json(
        { error: "coinSymbol is required for all-coins strategies" },
        { status: 400 },
      );
    }

    const coin = strategy.is_all_coins
      ? data.coinSymbol!.trim().toUpperCase()
      : strategy.coin_symbol.toUpperCase();

    const holding = await getOpenSpotHolding(accountId, coin);
    const entryPriceUsd = holding?.avgEntryPriceUsd ?? 0;

    const proceeds = data.quantitySold * data.executedPriceUsd;
    const realizedProfit =
      data.quantitySold * (data.executedPriceUsd - entryPriceUsd);

    await prisma.exit_strategy_execution.create({
      data: {
        exit_strategy_id: id,
        step_gain_percent: data.stepGainPercent,
        target_price: data.targetPriceUsd,
        executed_price: data.executedPriceUsd,
        quantity_sold: data.quantitySold,
        proceeds,
        realized_profit: realizedProfit,
      },
      select: { id: true },
    });

    const fresh = await buildExitStrategyDetails(accountId, id);
    return NextResponse.json({ data: fresh }, { status: 201 });
  } catch (err: unknown) {
    if (err instanceof z.ZodError)
      return NextResponse.json({ error: err.flatten() }, { status: 400 });
    console.error("[POST /api/exit-strategies/[id]/executions] error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
