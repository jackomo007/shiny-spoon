import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { warmDailyMarketAnalysis } from "@/lib/market-home-analysis";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const cronKey = req.headers.get("x-cron-key");
  const devKey =
    process.env.NODE_ENV !== "production"
      ? process.env.NEXT_PUBLIC_DEV_CRON_SECRET
      : undefined;

  const session = await getServerSession(authOptions).catch(() => null);
  const isAdmin = !!session?.user?.isAdmin;
  const isCron =
    !!cronKey && (cronKey === process.env.CRON_SECRET || cronKey === devKey);

  if (!isAdmin && !isCron) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const payload = await warmDailyMarketAnalysis();

    return NextResponse.json({
      ok: true,
      generatedAt: payload.meta.generatedAt,
      refreshBucket: payload.meta.refreshBucket,
      method: payload.meta.method,
      chartPoints: payload.meta.chartPoints,
    });
  } catch (error) {
    console.error("[POST /api/market/analysis/refresh] error:", error);
    return NextResponse.json(
      { error: "Failed to refresh market analysis" },
      { status: 500 },
    );
  }
}
