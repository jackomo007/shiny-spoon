import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";

const Q = z.object({ q: z.string().trim().min(1) });

const QUOTES = ["USDT", "USDC", "USD", "BTC", "ETH"] as const;
const PAIR_RE = new RegExp(`^([A-Z0-9]{2,})(${QUOTES.join("|")})$`, "i");

type Item = { id: string; symbol: string; name: string };

function isPureAssetSymbol(symbolRaw: string) {
  const s = (symbolRaw ?? "").trim().toUpperCase();
  if (!s) return false;
  if (!/^[A-Z0-9]{2,}$/.test(s)) return false;

  const m = s.match(PAIR_RE);
  if (m && m[1] && m[1].length >= 2) return false;

  return true;
}

function normalizeRawInput(raw: string) {
  return (raw ?? "").toUpperCase().trim().replace(/[\s/_-]+/g, "");
}

function baseCandidatesFromQuery(rawQuery: string): string[] {
  const raw = normalizeRawInput(rawQuery);

  const m = raw.match(PAIR_RE);
  const base0 = (m ? m[1] : raw).toUpperCase().trim();

  if (!base0) return [];

  const out: string[] = [base0];

  if (base0.endsWith("U") && base0.length >= 3) {
    out.push(base0.slice(0, -1));
  }

  return Array.from(new Set(out)).filter((s) => /^[A-Z0-9]{2,}$/.test(s));
}

async function fetchWithTimeout(url: string, init: RequestInit, ms = 3500) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), ms);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(id);
  }
}

async function fetchCmcItemsBySymbol(symbol: string, key: string): Promise<Item[]> {
  const url =
    `https://pro-api.coinmarketcap.com/v1/cryptocurrency/map` +
    `?listing_status=active&symbol=${encodeURIComponent(symbol)}`;

  const resp = await fetchWithTimeout(
    url,
    { headers: { "X-CMC_PRO_API_KEY": key }, cache: "no-store" },
    3500
  );

  if (!resp.ok) {
    const text = await resp.text().catch(() => "");
    console.warn("[CMC] failed", { status: resp.status, symbol, body: text.slice(0, 200) });
    return [];
  }

  const json = (await resp.json().catch(() => null)) as
    | { data?: Array<{ id: number; name: string; symbol: string }> }
    | null;

  const data = json?.data ?? [];
  return data
    .map((d) => ({
      id: String(d.id),
      symbol: (d.symbol ?? "").toUpperCase(),
      name: d.name ?? d.symbol,
    }))
    .filter((it) => isPureAssetSymbol(it.symbol));
}

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const parsed = Q.safeParse({ q: url.searchParams.get("q") ?? "" });

    if (!parsed.success) {
      return NextResponse.json({ items: [] }, { status: 200 });
    }

    const rawQuery = parsed.data.q;
    const candidates = baseCandidatesFromQuery(rawQuery);

    if (candidates.length === 0) {
      return NextResponse.json({ items: [] }, { status: 200 });
    }
    const fromDb = await prisma.verified_asset.findMany({
      where: {
        OR: candidates.flatMap((base) => [
          { symbol: { startsWith: base } },
          { name: { contains: base } },
        ]),
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

    if (key) {
      for (const base of candidates) {
        const cmcItems = await fetchCmcItemsBySymbol(base, key);

        if (cmcItems.length > 0) {
          const seen = new Set(items.map((i) => i.symbol.toUpperCase()));
          for (const it of cmcItems) {
            if (!seen.has(it.symbol.toUpperCase())) {
              items.push(it);
              seen.add(it.symbol.toUpperCase());
            }
          }
          break;
        }
      }
    } else {
      console.warn("[ASSETS] CMC_API_KEY missing; skipping CMC lookup");
    }

    return NextResponse.json({ items }, { status: 200 });
  } catch (e) {
    console.error("[ASSETS] handler error:", e);
    return NextResponse.json({ items: [] }, { status: 200 });
  }
}
