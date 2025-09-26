import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const q = (searchParams.get("q") || "").trim();

    if (!q) {
      return NextResponse.json({ items: [] }, { status: 200 });
    }

    const items = await prisma.verified_asset.findMany({
      where: {
        OR: [
          { symbol: { contains: q } },
          { name:   { contains: q } },
        ],
      },
      take: 20,
      orderBy: [{ symbol: "asc" }],
      select: { symbol: true, name: true, exchange: true },
    });

    return NextResponse.json({ items }, { status: 200 });
  } catch (err) {
    console.error("[assets/search] failed:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
