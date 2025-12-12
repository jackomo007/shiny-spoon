import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import {
  listPriceStructuresForAccount,
  upsertPriceStructureForCoin,
} from "@/services/price-structure.service";

const Body = z.object({
  symbol: z.string().min(2),
  exchange: z.string().optional(),
});

export async function GET() {
  const session = await getServerSession(authOptions);

  if (!session?.accountId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const items = await listPriceStructuresForAccount(session.accountId);
  return NextResponse.json({ items });
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);

  if (!session?.accountId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const json = await req.json().catch(() => ({}));
  const parsed = Body.safeParse(json);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { symbol, exchange } = parsed.data;

  try {
    const result = await upsertPriceStructureForCoin({
      accountId: session.accountId,
      assetSymbol: symbol,
      exchange,
    });

    return NextResponse.json(
      {
        ok: true,
        usedCache: result.usedCache,
        item: result,
      },
      { status: 201 },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Internal error";
    console.error("[add-coin] POST failed:", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
