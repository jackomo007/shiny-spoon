import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import pLimit from "p-limit";
import { runAnalysisForTracker } from "@/services/tracker.service";

const ALLOWED_KEYS = [
  "chart_analysis_system",
  "trade_analyzer_system",
  "trade_analyzer_template",
] as const;

type AllowedKey = (typeof ALLOWED_KEYS)[number];
function isAllowedKey(k: string): k is AllowedKey {
  return (ALLOWED_KEYS as readonly string[]).includes(k);
}

export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params;
  const key = id;

  if (!isAllowedKey(key)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const row = await prisma.app_prompt.findUnique({
    where: { key },
    select: {
      id: true,
      key: true,
      title: true,
      description: true,
      content: true,
      updated_at: true,
    },
  });

  if (!row) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json(row);
}

export async function PUT(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.isAdmin || !session.user.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await ctx.params;
  const key = id;
  if (!isAllowedKey(key)) {
    return NextResponse.json({ error: "Invalid key" }, { status: 400 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const payload = body as Partial<{
    content: string;
    title: string;
    description: string | null;
  }>;

  if (typeof payload.content !== "string" || payload.content.trim() === "") {
    return NextResponse.json({ error: "Missing content" }, { status: 400 });
  }

  const userIdNum = Number(session.user.id);

  const saved = await prisma.app_prompt.upsert({
    where: { key },
    update: {
      content: payload.content,
      ...(typeof payload.title === "string" ? { title: payload.title } : {}),
      ...(typeof payload.description !== "undefined"
        ? { description: payload.description }
        : {}),
      updated_by: Number.isFinite(userIdNum) ? userIdNum : null,
    },
    create: {
      key,
      title: payload.title ?? key,
      description:
        typeof payload.description !== "undefined" ? payload.description : null,
      content: payload.content,
      updated_by: Number.isFinite(userIdNum) ? userIdNum : null,
    },
    select: {
      id: true,
      key: true,
      title: true,
      description: true,
      content: true,
      updated_at: true,
    },
  });

  if (key === "chart_analysis_system") {
    const trackers = await prisma.chart_tracker.findMany({
      where: { active: true },
      orderBy: { updated_at: "desc" },
      take: 20,
      select: { id: true },
    });

    const limit = pLimit(2);

    void (async () => {
      try {
        await Promise.allSettled(
          trackers.map((t) => limit(() => runAnalysisForTracker(t.id)))
        );
      } catch {
        // swallow errors to avoid unhandled rejections
      }
    })();
  }

  return NextResponse.json(saved);
}
