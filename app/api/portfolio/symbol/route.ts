import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getOpenSpotHoldings } from "@/services/portfolio-holdings.service";

export const dynamic = "force-dynamic";

type SearchItem = {
  symbol: string;
  name: string | null;
};

export async function GET(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.accountId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const q = (searchParams.get("q") ?? "").trim().toUpperCase();

    const holdings = await getOpenSpotHoldings(session.accountId);
    if (holdings.length === 0) return NextResponse.json({ items: [] });

    const symbols = Array.from(
      new Set(
        holdings
          .map((h) => h.symbol.trim().toUpperCase())
          .filter((sym) => sym.length > 0),
      ),
    );

    const verified = await prisma.verified_asset.findMany({
      where: { symbol: { in: symbols } },
      select: { symbol: true, name: true },
    });

    const nameBySymbol = new Map(
      verified.map((asset) => [asset.symbol.toUpperCase(), asset.name ?? null]),
    );

    const items: SearchItem[] = symbols
      .sort((a, b) => a.localeCompare(b))
      .map((symbol) => ({
        symbol,
        name: nameBySymbol.get(symbol) ?? null,
      }));

    const filtered = q
      ? items.filter((item) => {
          const symbol = item.symbol.toUpperCase();
          const name = (item.name ?? "").toUpperCase();
          return symbol.includes(q) || name.includes(q);
        })
      : items;

    return NextResponse.json({ items: filtered });
  } catch (error) {
    console.error("[GET /api/portfolio/symbol] error:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
