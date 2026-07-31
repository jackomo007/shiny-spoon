import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { cgCoinPlatformsByIdSafe } from "@/lib/markets/coingecko";
import { buildPortfolioChainOptions } from "@/lib/portfolio-chains";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.accountId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const id = (searchParams.get("id") ?? "").trim();
  const symbol = (searchParams.get("symbol") ?? "").trim().toUpperCase();

  if (!symbol) {
    return NextResponse.json({ error: "Missing symbol" }, { status: 400 });
  }

  const platforms = id ? await cgCoinPlatformsByIdSafe(id) : null;
  const options = buildPortfolioChainOptions({
    symbol,
    platformIds: platforms?.platformIds ?? [],
  });

  return NextResponse.json({
    defaultChainId: options[0]?.id ?? "other",
    items: options,
  });
}
