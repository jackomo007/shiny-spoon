import { NextResponse } from "next/server";
import { z } from "zod";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const Body = z.object({
  side: z.enum(["buy", "sell"]),
  qty: z.number().positive(),
  priceUsd: z.number().positive(),
  feeUsd: z.number().min(0).optional(),
  executedAt: z.string().datetime().optional(),
});

export async function PUT(req: Request, ctx: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.accountId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const tradeId = ctx.params.id;
    const input = Body.parse(await req.json());

    const trade_datetime = input.executedAt ? new Date(input.executedAt) : undefined;

    const data: Record<string, unknown> = {
      side: input.side,
      amount: input.qty,
      entry_price: input.priceUsd,
      ...(trade_datetime ? { trade_datetime } : {}),
    };

    if (input.side === "buy") data.buy_fee = input.feeUsd ?? 0;
    if (input.side === "sell") data.sell_fee = input.feeUsd ?? 0;

    const result = await prisma.journal_entry.updateMany({
      where: {
        id: tradeId,
        account_id: session.accountId,
        spot_trade: { some: {} },
        asset_name: { not: "CASH" },
        side: { in: ["buy", "sell"] },
      },
      data,
    });

    if (result.count === 0) {
      return NextResponse.json({ error: "Transaction not found" }, { status: 404 });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.flatten() }, { status: 400 });
    }
    console.error("[PUT /api/portfolio/transaction/:id] error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

export async function DELETE(req: Request, ctx: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.accountId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const tradeId = ctx.params.id;

    const result = await prisma.journal_entry.deleteMany({
      where: {
        id: tradeId,
        account_id: session.accountId,
        spot_trade: { some: {} },
        asset_name: { not: "CASH" },
        side: { in: ["buy", "sell"] },
      },
    });

    if (result.count === 0) {
      return NextResponse.json({ error: "Transaction not found" }, { status: 404 });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[DELETE /api/portfolio/transaction/:id] error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
