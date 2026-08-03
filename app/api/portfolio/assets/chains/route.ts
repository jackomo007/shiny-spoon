import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import {
  cgAssetPlatformsSafe,
  cgCoinPlatformsByIdSafe,
} from "@/lib/markets/coingecko";
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
  const query = (searchParams.get("q") ?? "").trim();

  if (!symbol) {
    return NextResponse.json({ error: "Missing symbol" }, { status: 400 });
  }

  const [coinPlatforms, assetPlatforms] = await Promise.all([
    id ? cgCoinPlatformsByIdSafe(id) : null,
    cgAssetPlatformsSafe(),
  ]);
  const options = buildPortfolioChainOptions({
    symbol,
    platformIds: coinPlatforms?.platformIds ?? [],
    platforms: assetPlatforms.items.map((platform) => ({
      id: platform.id,
      name: platform.name,
      shortname: platform.shortname,
      nativeCoinId: platform.native_coin_id,
    })),
    query,
    limit: 5,
  });

  return NextResponse.json({
    defaultChainId: options[0]?.id ?? "other",
    items: options,
  });
}
