import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { PortfolioRepo } from "@/data/repositories/portfolio.repo"

type Item = {
  symbol: string
  amount: number
  avgEntryPriceUsd: number
  currentPriceUsd: number
  purchaseValueUsd: number
  valueUsd: number
  percent: number
  currentPriceSource?: "binance" | "coingecko" | "db_cache" | "avg_entry"
  currentPriceIsEstimated?: boolean
}

export const dynamic = "force-dynamic"

type PriceSource = "binance" | "coingecko" | "db_cache" | "avg_entry"
type PriceResult = { price: number; source: PriceSource; isEstimated: boolean }

const PRICE_TTL_MS = 30_000
const NEGATIVE_TTL_MS = 60_000
const CG_ID_TTL_MS = 24 * 60 * 60 * 1000

type CachedPrice = { price: number; source: "binance" | "coingecko" | "db_cache"; ts: number }
const PRICE_CACHE = new Map<string, CachedPrice>()
const NEGATIVE_CACHE = new Map<string, { ts: number; reason: string }>()
const CG_ID_CACHE = new Map<string, { id: string; ts: number }>()

const COINGECKO_MAX_CONCURRENCY = 2
let coingeckoInFlight = 0
const coingeckoQueue: Array<() => void> = []

async function withCoinGeckoSlot<T>(fn: () => Promise<T>): Promise<T> {
  if (coingeckoInFlight >= COINGECKO_MAX_CONCURRENCY) {
    await new Promise<void>((resolve) => coingeckoQueue.push(resolve))
  }
  coingeckoInFlight++
  try {
    return await fn()
  } finally {
    coingeckoInFlight--
    const next = coingeckoQueue.shift()
    if (next) next()
  }
}

function isFresh(ts: number, ttl: number) {
  return Date.now() - ts < ttl
}


async function fetchJson<T>(url: string, ms = 3000): Promise<T> {
  const controller = new AbortController()
  const id = setTimeout(() => controller.abort(), ms)
  try {
    const res = await fetch(url, { signal: controller.signal, cache: "no-store" })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    return (await res.json()) as T
  } finally {
    clearTimeout(id)
  }
}

async function getBinancePriceUsdt(pair: string): Promise<number> {
  const url = `https://api.binance.com/api/v3/ticker/price?symbol=${encodeURIComponent(pair)}`
  const json = await fetchJson<{ price?: string }>(url, 2500)
  const p = Number(json?.price)
  if (!Number.isFinite(p) || p <= 0) throw new Error("Invalid Binance price")
  return p
}

async function getCoinGeckoId(symbol: string): Promise<string> {
  const q = symbol.replace(/USDT$/i, "").toLowerCase()

  const cached = CG_ID_CACHE.get(q)
  if (cached && isFresh(cached.ts, CG_ID_TTL_MS)) return cached.id

  return withCoinGeckoSlot(async () => {
    const search = await fetchJson<{ coins?: { id: string; symbol: string }[] }>(
      `https://api.coingecko.com/api/v3/search?query=${encodeURIComponent(q)}`,
      3000
    )

    const match =
      search?.coins?.find((c) => c.symbol?.toLowerCase() === q) ??
      search?.coins?.[0]

    if (!match?.id) throw new Error("CoinGecko id not found")

    CG_ID_CACHE.set(q, { id: match.id, ts: Date.now() })
    return match.id
  })
}

async function getCoinGeckoPriceUsd(symbol: string): Promise<number> {
  const id = await getCoinGeckoId(symbol)

  return withCoinGeckoSlot(async () => {
    const price = await fetchJson<Record<string, { usd?: number }>>(
      `https://api.coingecko.com/api/v3/simple/price?ids=${encodeURIComponent(id)}&vs_currencies=usd`,
      3000
    )

    const p = Number(price?.[id]?.usd)
    if (!Number.isFinite(p) || p <= 0) throw new Error("Invalid CoinGecko price")
    return p
  })
}

async function getDbCachedPriceUsd(accountId: string, symbol: string): Promise<number | null> {
  const row = await prisma.coin_price_structure.findFirst({
    where: { account_id: accountId, asset_symbol: symbol },
    select: { last_price: true },
  })

  const p = Number(row?.last_price)
  return Number.isFinite(p) && p > 0 ? p : null
}

async function resolveCurrentPriceUsd(
  accountId: string,
  symbol: string,
  avgEntry: number
): Promise<PriceResult> {
  if (symbol === "CASH") return { price: 1, source: "avg_entry", isEstimated: false }

  const neg = NEGATIVE_CACHE.get(symbol)
  if (neg && isFresh(neg.ts, NEGATIVE_TTL_MS)) {
    const cachedDb = await getDbCachedPriceUsd(accountId, symbol)
    if (cachedDb != null) return { price: cachedDb, source: "db_cache", isEstimated: true }
    return { price: avgEntry, source: "avg_entry", isEstimated: true }
  }

  const cached = PRICE_CACHE.get(symbol)
  if (cached && isFresh(cached.ts, PRICE_TTL_MS)) {
    return { price: cached.price, source: cached.source, isEstimated: cached.source === "db_cache" }
  }

  const pair = symbol.endsWith("USDT") ? symbol : `${symbol}USDT`

  try {
    const p = await getBinancePriceUsdt(pair)
    PRICE_CACHE.set(symbol, { price: p, source: "binance", ts: Date.now() })
    return { price: p, source: "binance", isEstimated: false }
  } catch (e) {
    console.warn(`[PRICE] Binance failed for ${pair}:`, e)
  }

  try {
    const p = await getDbCachedPriceUsd(accountId, symbol)
    if (p != null) {
      PRICE_CACHE.set(symbol, { price: p, source: "db_cache", ts: Date.now() })
      return { price: p, source: "db_cache", isEstimated: true }
    }
  } catch (e) {
    console.warn(`[PRICE] DB cache failed for ${symbol}:`, e)
  }

  try {
    const p = await getCoinGeckoPriceUsd(symbol)
    PRICE_CACHE.set(symbol, { price: p, source: "coingecko", ts: Date.now() })
    return { price: p, source: "coingecko", isEstimated: false }
  } catch (e) {
    console.warn(`[PRICE] CoinGecko failed for ${symbol}:`, e)
  }

  NEGATIVE_CACHE.set(symbol, { ts: Date.now(), reason: "all_sources_failed" })
  return { price: avgEntry, source: "avg_entry", isEstimated: true }
}


export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.accountId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const accountId = session.accountId

    const [openBuys, cashUsd] = await Promise.all([
      prisma.journal_entry.findMany({
        where: {
          account_id: accountId,
          spot_trade: { some: {} },
          status: "in_progress",
          side: "buy",
          asset_name: { not: "CASH" },
        },
        select: { asset_name: true, amount: true, entry_price: true },
      }),
      PortfolioRepo.getCashBalance(accountId),
    ])

    const grouped: Record<string, { qty: number; investedUsd: number }> = {}

    for (const row of openBuys) {
      const sym = String(row.asset_name || "").trim().toUpperCase()
      const qty = Number(row.amount ?? 0)
      const entry = Number(row.entry_price ?? 0)

      if (!sym || qty <= 0) continue

      if (!grouped[sym]) grouped[sym] = { qty: 0, investedUsd: 0 }
      grouped[sym].qty += qty
      grouped[sym].investedUsd += qty * entry
    }

    const symbols = Object.keys(grouped)

    const priceBySymbol = new Map<string, PriceResult>()

    await Promise.all(
      symbols.map(async (sym) => {
        const g = grouped[sym]
        const avgEntry = g.qty > 0 ? g.investedUsd / g.qty : 0
        const resolved = await resolveCurrentPriceUsd(accountId, sym, avgEntry)
        priceBySymbol.set(sym, resolved)
      })
    )

    const spotCurrentValueUsd = symbols.reduce((sum, sym) => {
      const g = grouped[sym]
      const p = priceBySymbol.get(sym)?.price ?? 0
      return sum + g.qty * p
    }, 0)

    const spotInvestedUsd = symbols.reduce((sum, sym) => sum + grouped[sym].investedUsd, 0)

    const items: Item[] = symbols
      .map((sym) => {
        const g = grouped[sym]
        const amount = g.qty
        const avgEntryPriceUsd = amount > 0 ? g.investedUsd / amount : 0

        const r = priceBySymbol.get(sym)
        const currentPriceUsd = r?.price ?? avgEntryPriceUsd

        const valueUsd = amount * currentPriceUsd
        const purchaseValueUsd = amount * avgEntryPriceUsd

        return {
          symbol: sym,
          amount,
          avgEntryPriceUsd,
          currentPriceUsd,
          purchaseValueUsd,
          valueUsd,
          percent: spotCurrentValueUsd > 0 ? (valueUsd / spotCurrentValueUsd) * 100 : 0,
          currentPriceSource: r?.source ?? "avg_entry",
          currentPriceIsEstimated: r?.isEstimated ?? true,
        }
      })
      .sort((a, b) => b.valueUsd - a.valueUsd)

    const totalValueUsd = spotCurrentValueUsd + (cashUsd ?? 0)
    const totalInvestedUsd = spotInvestedUsd

    return NextResponse.json({
      totalValueUsd,
      totalInvestedUsd,
      cashUsd,
      items,
    })
  } catch (e: unknown) {
    const err = e as { code?: string }
    if (err?.code === "P2024") {
      return NextResponse.json({ error: "Database busy, try again." }, { status: 503 })
    }
    console.error("[GET /api/portfolio] error:", e)
    return NextResponse.json({ error: "Internal error" }, { status: 500 })
  }
}
