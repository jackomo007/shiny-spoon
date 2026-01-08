import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";

const Q = z.object({ q: z.string().trim().min(1) });

const QUOTES = ["USDT", "USDC", "USD", "BTC", "ETH"] as const;
const PAIR_RE = new RegExp(`^([A-Z0-9]{2,})(${QUOTES.join("|")})$`, "i");

type Item = { id: string; symbol: string; name: string };

function pushIfMissing(items: Item[], it: Item) {
  const key = it.symbol.toUpperCase();
  if (!items.some((x) => x.symbol.toUpperCase() === key)) {
    items.push(it);
  }
}

function isPureAssetSymbol(symbolRaw: string) {
  const s = (symbolRaw ?? "").trim().toUpperCase();
  if (!s) return false;
  if (!/^[A-Z0-9]{2,}$/.test(s)) return false;

  const m = s.match(PAIR_RE);
  if (m && m[1] && m[1].length >= 2) return false;

  return true;
}

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const parsed = Q.safeParse({ q: url.searchParams.get("q") ?? "" });

    if (!parsed.success) {
      return NextResponse.json({ items: [] }, { status: 200 });
    }

    const raw = parsed.data.q.toUpperCase().trim();
    const m = raw.match(PAIR_RE);

    const base = (m ? m[1] : raw).toUpperCase().trim();

    const fromDb = await prisma.verified_asset.findMany({
      where: {
        OR: [
          { symbol: { startsWith: base } },
          { name: { contains: base } },
        ],
      },
      orderBy: { symbol: "asc" },
      take: 50,
    });

    const items: Item[] = fromDb
      .map((r) => ({
        id: r.symbol,
        symbol: r.symbol.toUpperCase(),
        name: (r.name ?? r.symbol).toString(),
      }))
      .filter((it) => isPureAssetSymbol(it.symbol));

    const key = process.env.CMC_API_KEY;
    if (key && /^[A-Z0-9]{2,}$/.test(base)) {
      const resp = await fetch(
        `https://pro-api.coinmarketcap.com/v1/cryptocurrency/map?listing_status=active&limit=50&symbol=${encodeURIComponent(
          base
        )}`,
        { headers: { "X-CMC_PRO_API_KEY": key }, cache: "no-store" }
      );

      if (resp.ok) {
        const data = (await resp.json()) as {
          data?: Array<{ id: number; name: string; symbol: string }>;
        };

        const cmcItems: Item[] = (data.data ?? [])
          .map((d) => ({
            id: String(d.id),
            symbol: d.symbol.toUpperCase(),
            name: d.name,
          }))
          .filter((it) => isPureAssetSymbol(it.symbol));

        const seen = new Set(items.map((i) => i.symbol.toUpperCase()));
        for (const it of cmcItems) {
          if (!seen.has(it.symbol.toUpperCase())) {
            items.push(it);
            seen.add(it.symbol.toUpperCase());
          }
        }
      }
    }

    return NextResponse.json({ items }, { status: 200 });
  } catch {
    return NextResponse.json({ items: [] }, { status: 200 });
  }
}
