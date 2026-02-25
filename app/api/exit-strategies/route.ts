import { NextResponse } from "next/server";
import { z } from "zod";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { buildExitStrategySummary } from "@/services/exit-strategy.service";

export const dynamic = "force-dynamic";

const CreateBody = z.union([
  z.object({
    allCoins: z.literal(true),
    strategyType: z.literal("percentage"),
    sellPercent: z.number().positive().max(100),
    gainPercent: z.number().positive().max(10_000),
  }),
  z.object({
    allCoins: z.literal(false),
    coinSymbols: z.array(z.string().min(1)).min(1),
    strategyType: z.literal("percentage"),
    sellPercent: z.number().positive().max(100),
    gainPercent: z.number().positive().max(10_000),
  }),
]);

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.accountId)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const accountId = session.accountId;

    const list = await prisma.exit_strategy.findMany({
      where: { account_id: accountId },
      orderBy: { created_at: "desc" },
      select: { id: true },
    });

    const data = await Promise.all(
      list.map((s) => buildExitStrategySummary(accountId, s.id)),
    );
    return NextResponse.json({ data });
  } catch (e) {
    console.error("[GET /api/exit-strategies] error:", e);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.accountId)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const accountId = session.accountId;
    const body = CreateBody.parse(await req.json());

    if (body.allCoins === true) {
      const created = await prisma.exit_strategy.create({
        data: {
          account_id: accountId,
          coin_symbol: "",
          is_all_coins: true,
          strategy_type: "percentage",
          sell_percent: body.sellPercent,
          gain_percent: body.gainPercent,
          is_active: true,
        },
        select: { id: true },
      });

      const summary = await buildExitStrategySummary(accountId, created.id);
      return NextResponse.json({ data: [summary] }, { status: 201 });
    }

    const coins = body.coinSymbols.map((c) => c.trim().toUpperCase());

    const created = await prisma.$transaction(
      coins.map((coin) =>
        prisma.exit_strategy.create({
          data: {
            account_id: accountId,
            coin_symbol: coin,
            is_all_coins: false,
            strategy_type: "percentage",
            sell_percent: body.sellPercent,
            gain_percent: body.gainPercent,
            is_active: true,
          },
          select: { id: true },
        }),
      ),
    );

    const data = await Promise.all(
      created.map((s) => buildExitStrategySummary(accountId, s.id)),
    );
    return NextResponse.json({ data }, { status: 201 });
  } catch (err: unknown) {
    if (err instanceof z.ZodError)
      return NextResponse.json({ error: err.flatten() }, { status: 400 });

    if (
      typeof err === "object" &&
      err !== null &&
      "code" in err &&
      err.code === "P2002"
    ) {
      return NextResponse.json(
        {
          error:
            "An exit strategy already exists for one or more of the selected coins.",
        },
        { status: 409 },
      );
    }

    console.error("[POST /api/exit-strategies] error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
