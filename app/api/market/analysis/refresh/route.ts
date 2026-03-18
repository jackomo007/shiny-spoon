import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import {
  getRefreshBucket,
  isScheduledRefreshWindow,
  warmDailyMarketAnalysis,
} from "@/lib/market-home-analysis";

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

  const now = new Date();
  if (isCron && !isScheduledRefreshWindow(now)) {
    return NextResponse.json({
      ok: true,
      skipped: true,
      reason: "Outside 9:00 AM America/New_York window",
      refreshBucket: getRefreshBucket(now),
    });
  }

  try {
    const payload = await warmDailyMarketAnalysis(now);

    return NextResponse.json({
      ok: true,
      refreshBucket: payload.meta.refreshBucket,
      generatedAt: payload.meta.generatedAt,
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
