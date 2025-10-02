import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type Bucket = "day" | "week" | "month";
type Kind = "chart" | "trade";

function startOf(d: Date, bucket: Bucket) {
  const x = new Date(d);
  if (bucket === "day") {
    x.setHours(0, 0, 0, 0);
  } else if (bucket === "week") {
    const day = x.getDay();
    const diff = (day + 6) % 7;
    x.setDate(x.getDate() - diff);
    x.setHours(0, 0, 0, 0);
  } else {
    x.setDate(1);
    x.setHours(0, 0, 0, 0);
  }
  return x;
}

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const sinceStr = req.nextUrl.searchParams.get("since");
  const untilStr = req.nextUrl.searchParams.get("until");
  const bucket = (req.nextUrl.searchParams.get("bucket") as Bucket) || "day";

  const until = untilStr ? new Date(untilStr) : new Date();
  const since =
    sinceStr ? new Date(sinceStr) : new Date(new Date().setDate(until.getDate() - 30));

  const rows = await prisma.ai_usage.findMany({
    where: { created_at: { gte: since, lte: until } },
    select: { kind: true, cost_usd: true, created_at: true },
    orderBy: { created_at: "asc" },
  });

  type Key = string;

  const fmtKey = (d: Date): Key => {
    const s = startOf(d, bucket);
    const y = s.getFullYear();
    const m = String(s.getMonth() + 1).padStart(2, "0");
    const dd = String(s.getDate()).padStart(2, "0");
    if (bucket === "day") return `${y}-${m}-${dd}`;
    if (bucket === "month") return `${y}-${m}`;
    const oneJan = new Date(s.getFullYear(), 0, 1);
    const diffMs = s.getTime() - oneJan.getTime();
    const dayOfYear = Math.floor(diffMs / 86400000) + 1;
    const week = Math.ceil((dayOfYear + ((oneJan.getDay() + 6) % 7)) / 7);
    return `${y}-W${String(week).padStart(2, "0")}`;
  };

  const total: Record<Kind | "all", number> = { chart: 0, trade: 0, all: 0 };
  const series: Record<Key, Record<Kind | "all", number>> = {};

  for (const r of rows) {
    const k = fmtKey(r.created_at);
    if (!series[k]) series[k] = { chart: 0, trade: 0, all: 0 };

    const v = Number(r.cost_usd);
    const kind = r.kind as Kind;

    series[k][kind] += v;
    series[k].all += v;

    total[kind] += v;
    total.all += v;
  }

  return NextResponse.json({
    range: { since: since.toISOString(), until: until.toISOString(), bucket },
    total,
    series: Object.entries(series)
      .sort(([a], [b]) => (a < b ? -1 : 1))
      .map(([key, v]) => ({ key, chart: v.chart, trade: v.trade, all: v.all })),
  });
}
