import { prisma } from "@/lib/prisma"

export type PriceSource = "binance" | "coingecko" | "db_cache" | "avg_entry"
export type PriceResult = { price: number; source: PriceSource; isEstimated: boolean }

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

    const match = search?.coins?.find((c) => c.symbol?.toLowerCase() === q) ?? search?.coins?.[0]
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

export async function resolveCurrentPriceUsd(
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
  } catch {
    // ignore
  }

  try {
    const p = await getDbCachedPriceUsd(accountId, symbol)
    if (p != null) {
      PRICE_CACHE.set(symbol, { price: p, source: "db_cache", ts: Date.now() })
      return { price: p, source: "db_cache", isEstimated: true }
    }
  } catch {
    // ignore
  }

  try {
    const p = await getCoinGeckoPriceUsd(symbol)
    PRICE_CACHE.set(symbol, { price: p, source: "coingecko", ts: Date.now() })
    return { price: p, source: "coingecko", isEstimated: false }
  } catch {
    // ignore
  }

  NEGATIVE_CACHE.set(symbol, { ts: Date.now(), reason: "all_sources_failed" })
  return { price: avgEntry, source: "avg_entry", isEstimated: true }
}
