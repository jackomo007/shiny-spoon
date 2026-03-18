import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getDailyMarketAnalysis } from "@/lib/market-home-analysis";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.accountId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const payload = await getDailyMarketAnalysis();
    return NextResponse.json(payload);
  } catch (error) {
    console.error("[GET /api/market/analysis] error:", error);
    return NextResponse.json(
      { error: "Failed to generate market analysis" },
      { status: 500 },
    );
  }
}
