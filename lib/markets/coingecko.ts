export type CoinGeckoSearchResult = {
  id: string
  symbol: string
  name: string
  thumb?: string
  large?: string
}

export type CoinGeckoMarketCoin = {
  id: string
  symbol: string
  name: string
  image?: string
  current_price?: number
  price_change_percentage_24h?: number
  market_cap?: number
  market_cap_rank?: number
}

const CG_BASE = "https://api.coingecko.com/api/v3"

const TTL_MS = {
  search: 30_000,
  top: 60_000,
  price: 15_000,
  negative: 60_000,
}

type CacheEntry<T> = { ts: number; value: T }
const cache = new Map<string, CacheEntry<unknown>>()

function isFresh(ts: number, ttl: number) {
  return Date.now() - ts < ttl
}

function sleep(ms: number) {
  return new Promise<void>((r) => setTimeout(r, ms))
}

type HttpErr = Error & { status?: number }

async function fetchJson<T>(url: string, ms = 5000): Promise<T> {
  const controller = new AbortController()
  const id = setTimeout(() => controller.abort(), ms)
  try {
    const res = harmoniousFetch(url, controller.signal) // wrapper abaixo
    const resolved = await res

    if (!resolved.ok) {
      const err = new Error(`CoinGecko HTTP ${resolved.status}`) as HttpErr
      err.status = resolved.status
      throw err
    }

    return (await resolved.json()) as T
  } finally {
    clearTimeout(id)
  }
}

// separo para facilitar testes e manter fetchJson limpo
async function harmoniousFetch(url: string, signal: AbortSignal): Promise<Response> {
  return fetch(url, { signal, cache: "no-store" })
}

async function fetchJsonWithRetry<T>(url: string, ms = 5000): Promise<T> {
  const attempts = 3

  for (let i = 0; i < attempts; i++) {
    try {
      return await fetchJson<T>(url, ms)
    } catch (e) {
      const err = e as HttpErr
      const status = err?.status
      const retryable = status === 429 || (typeof status === "number" && status >= 500) || err?.name === "AbortError"

      if (!retryable || i === attempts - 1) throw e

      // backoff simples (250ms, 1s, 2.25s)
      await sleep(250 * (i + 1) * (i + 1))
    }
  }

  throw new Error("CoinGecko retry failed")
}

export async function cgTopByMarketCap(limit = 6): Promise<CoinGeckoMarketCoin[]> {
  const key = `top:${limit}`
  const c = cache.get(key) as CacheEntry<CoinGeckoMarketCoin[]> | undefined
  if (c && isFresh(c.ts, TTL_MS.top)) return c.value

  const url =
    `${CG_BASE}/coins/markets?vs_currency=usd&order=market_cap_desc` +
    `&per_page=${encodeURIComponent(String(limit))}&page=1&sparkline=false&price_change_percentage=24h`

  const value = await fetchJsonWithRetry<CoinGeckoMarketCoin[]>(url, 6000)
  cache.set(key, { ts: Date.now(), value })
  return value
}

export async function cgSearch(query: string): Promise<CoinGeckoSearchResult[]> {
  const q = query.trim()
  if (!q) return []
  const key = `search:${q.toLowerCase()}`
  const c = cache.get(key) as CacheEntry<CoinGeckoSearchResult[]> | undefined
  if (c && isFresh(c.ts, TTL_MS.search)) return c.value

  const url = `${CG_BASE}/search?query=${encodeURIComponent(q)}`
  const json = await fetchJsonWithRetry<{ coins?: CoinGeckoSearchResult[] }>(url, 6000)
  const value = (json?.coins ?? []).slice(0, 12)
  cache.set(key, { ts: Date.now(), value })
  return value
}

/**
 * Mantém a assinatura antiga (compat).
 * Atenção: ESSA função joga exception em 429/5xx e pode quebrar endpoint se usada direto.
 */
export async function cgPriceUsdById(id: string): Promise<{ priceUsd: number; change24hPct: number | null }> {
  const key = `price:${id}`
  const c = cache.get(key) as CacheEntry<{ priceUsd: number; change24hPct: number | null }> | undefined
  if (c && isFresh(c.ts, TTL_MS.price)) return c.value

  const url =
    `${CG_BASE}/coins/markets?vs_currency=usd&ids=${encodeURIComponent(id)}` +
    `&sparkline=false&price_change_percentage=24h`

  const rows = await fetchJsonWithRetry<CoinGeckoMarketCoin[]>(url, 6000)
  const row = rows?.[0]
  const priceUsd = Number(row?.current_price ?? 0)
  const change24hPct = row?.price_change_percentage_24h == null ? null : Number(row.price_change_percentage_24h)

  if (!Number.isFinite(priceUsd) || priceUsd <= 0) throw new Error("Invalid CoinGecko price")

  const value = { priceUsd, change24hPct: Number.isFinite(change24hPct) ? change24hPct : null }
  cache.set(key, { ts: Date.now(), value })
  return value
}

export type CgPriceOk = { ok: true; priceUsd: number; change24hPct: number | null }
export type CgPriceErr = { ok: false; reason: "rate_limited" | "not_found" | "invalid" | "network" | "other" }
export type CgPriceResult = CgPriceOk | CgPriceErr

/**
 * ✅ Versão SAFE: nunca joga exception.
 * Use essa no backend /api/portfolio para não virar 500 quando CoinGecko der 429.
 */
export async function cgPriceUsdByIdSafe(id: string): Promise<CgPriceResult> {
  const okKey = `price_ok:${id}`
  const okCached = cache.get(okKey) as CacheEntry<CgPriceOk> | undefined
  if (okCached && isFresh(okCached.ts, TTL_MS.price)) return okCached.value

  const negKey = `price_neg:${id}`
  const negCached = cache.get(negKey) as CacheEntry<CgPriceErr> | undefined
  if (negCached && isFresh(negCached.ts, TTL_MS.negative)) return negCached.value

  const url =
    `${CG_BASE}/coins/markets?vs_currency=usd&ids=${encodeURIComponent(id)}` +
    `&sparkline=false&price_change_percentage=24h`

  try {
    const rows = await fetchJsonWithRetry<CoinGeckoMarketCoin[]>(url, 6000)
    const row = rows?.[0]

    const priceUsd = Number(row?.current_price ?? 0)
    const change24hPct = row?.price_change_percentage_24h == null ? null : Number(row.price_change_percentage_24h)

    if (!Number.isFinite(priceUsd) || priceUsd <= 0) {
      const bad: CgPriceErr = { ok: false, reason: "invalid" }
      cache.set(negKey, { ts: Date.now(), value: bad })
      return bad
    }

    const ok: CgPriceOk = { ok: true, priceUsd, change24hPct: Number.isFinite(change24hPct) ? change24hPct : null }
    cache.set(okKey, { ts: Date.now(), value: ok })
    return ok
  } catch (e) {
    const err = e as HttpErr
    const status = err?.status

    const reason: CgPriceErr["reason"] =
      status === 429 ? "rate_limited" : status === 404 ? "not_found" : err?.name === "AbortError" ? "network" : "other"

    const bad: CgPriceErr = { ok: false, reason }
    cache.set(negKey, { ts: Date.now(), value: bad })
    return bad
  }
}
