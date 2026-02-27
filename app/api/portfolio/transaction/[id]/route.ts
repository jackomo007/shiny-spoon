import { NextResponse } from "next/server";
import { z } from "zod";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { PortfolioRepoV2 } from "@/data/repositories/portfolio.repo.v2";
import { migrateLegacyPortfolioTrades } from "@/services/portfolio-legacy-migration.service";

export const dynamic = "force-dynamic";

const Body = z.object({
  side: z.enum(["buy", "sell"]),
  qty: z.number().positive(),
  priceUsd: z.number().positive(),
  feeUsd: z.number().min(0).optional(),
  executedAt: z.string().datetime().optional(),
});

type RouteContext = {
  params: {
    id: string;
  };
};

export async function PUT(req: Request, context: unknown) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.accountId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { params } = context as RouteContext;
    const tradeId = params.id;
    await migrateLegacyPortfolioTrades(session.accountId);

    const input = Body.parse(await req.json());

    const updated = await PortfolioRepoV2.updateSpotTransaction({
      accountId: session.accountId,
      tradeId,
      side: input.side,
      qty: input.qty,
      priceUsd: input.priceUsd,
      feeUsd: input.feeUsd ?? 0,
      executedAt: input.executedAt ? new Date(input.executedAt) : undefined,
    });

    if (!updated) {
      return NextResponse.json(
        { error: "Transaction not found" },
        { status: 404 }
      );
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

export async function DELETE(_req: Request, context: unknown) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.accountId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { params } = context as RouteContext;
    const tradeId = params.id;
    await migrateLegacyPortfolioTrades(session.accountId);

    const deleted = await PortfolioRepoV2.deleteSpotTransaction({
      accountId: session.accountId,
      tradeId,
    });

    if (!deleted) {
      return NextResponse.json(
        { error: "Transaction not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[DELETE /api/portfolio/transaction/:id] error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
