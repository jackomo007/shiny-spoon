export type CgCoinImage = {
  thumb?: string | null
  small?: string | null
  large?: string | null
}

export type CgCoinMeta = {
  id: string
  symbol: string
  name: string
  image: CgCoinImage | null
}

export type CgPrice = {
  id: string
  priceUsd: number
  change24hPct: number | null
}

export type CgMarketCoin = {
  id: string
  symbol: string
  name: string
  image: string | null
  current_price: number | null
  price_change_percentage_24h: number | null
  market_cap_rank: number | null
}

export type CgSearchItem = {
  id: string
  name: string
  symbol: string
  thumb: string | null
}

type CacheEntry<T> = { value: T; expiresAt: number }
const memCache = new Map<string, CacheEntry<unknown>>()

function getCache<T>(key: string): T | null {
  const hit = memCache.get(key)
  if (!hit) return null
  if (Date.now() > hit.expiresAt) {
    memCache.delete(key)
    return null
  }
  return hit.value as T
}

function setCache<T>(key: string, value: T, ttlMs: number): void {
  memCache.set(key, { value, expiresAt: Date.now() + ttlMs })
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms))
}

function baseUrl(): string {
  const isPro = process.env.COINGECKO_PRO === "true"
  return isPro ? "https://pro-api.coingecko.com/api/v3" : "https://api.coingecko.com/api/v3"
}

function coinGeckoHeaders(): Record<string, string> {
  const key = process.env.COINGECKO_API_KEY
  if (!key) return {}
  return { "x-cg-pro-api-key": key }
}

async function cgFetch(url: string): Promise<Response> {
  const tries = 3
  for (let attempt = 0; attempt < tries; attempt++) {
    const res = await fetch(url, { cache: "no-store", headers: coinGeckoHeaders() })
    if (res.ok) return res

    if (res.status === 429 || (res.status >= 500 && res.status <= 599)) {
      const backoff = 250 * Math.pow(2, attempt)
      await sleep(backoff)
      continue
    }

    return res
  }

  return fetch(url, { cache: "no-store", headers: coinGeckoHeaders() })
}

function toStringSafe(v: unknown): string | null {
  return typeof v === "string" ? v : null
}

function toNumberSafe(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v)
}

function normalizeIdCandidate(s: string): string {
  return s.trim().toLowerCase()
}

function clampInt(n: number, min: number, max: number): number {
  const x = Math.trunc(n)
  if (x < min) return min
  if (x > max) return max
  return x
}

type CgSearchResponse = {
  coins?: unknown
}

type CgSearchCoinRaw = {
  id?: unknown
  name?: unknown
  symbol?: unknown
  market_cap_rank?: unknown
  thumb?: unknown
}

export async function cgSearch(query: string): Promise<CgSearchItem[]> {
  const q = query.trim()
  if (!q) return []

  const cacheKey = `cg:search:${q.toLowerCase()}`
  const cached = getCache<CgSearchItem[]>(cacheKey)
  if (cached) return cached

  const url = `${baseUrl()}/search?query=${encodeURIComponent(q)}`
  const res = await cgFetch(url)
  if (!res.ok) throw new Error(`CoinGecko /search HTTP ${res.status}`)

  const j = (await res.json()) as CgSearchResponse
  if (!isPlainObject(j)) return []

  const coinsRaw = j.coins
  if (!Array.isArray(coinsRaw)) return []

  const out: CgSearchItem[] = []

  for (const item of coinsRaw) {
    if (!isPlainObject(item)) continue
    const raw = item as CgSearchCoinRaw

    const id = toStringSafe(raw.id) ?? ""
    const name = toStringSafe(raw.name) ?? ""
    const symbol = toStringSafe(raw.symbol) ?? ""
    const thumb = toStringSafe(raw.thumb)

    if (!id || !symbol) continue

    out.push({
      id,
      name,
      symbol,
      thumb: thumb ?? null,
    })
  }

  setCache(cacheKey, out, 60_000)
  return out
}

export async function cgResolveIdFromSymbol(symbol: string): Promise<string | null> {
  const q = symbol.trim()
  if (!q) return null

  const items = await cgSearch(q)
  if (!items.length) return null

  const target = q.toLowerCase()

  const exact = items.filter((c) => c.symbol.toLowerCase() === target)
  const pickFrom = exact.length ? exact : items

  pickFrom.sort((a, b) => a.id.localeCompare(b.id))

  return pickFrom[0]?.id ?? null
}

type CgCoinsByIdResponse = {
  id?: unknown
  symbol?: unknown
  name?: unknown
  image?: unknown
}

export async function cgCoinMetaById(id: string): Promise<CgCoinMeta> {
  const coinId = normalizeIdCandidate(id)

  const cacheKey = `cg:meta:${coinId}`
  const cached = getCache<CgCoinMeta>(cacheKey)
  if (cached) return cached

  const url =
    `${baseUrl()}/coins/${encodeURIComponent(coinId)}` +
    `?localization=false&tickers=false&market_data=false&community_data=false&developer_data=false&sparkline=false`

  const res = await cgFetch(url)
  if (!res.ok) throw new Error(`CoinGecko /coins/{id} HTTP ${res.status}`)

  const j = (await res.json()) as CgCoinsByIdResponse
  if (!isPlainObject(j)) throw new Error("Invalid CoinGecko response")

  const rid = toStringSafe(j.id) ?? coinId
  const rsymbol = toStringSafe(j.symbol) ?? ""
  const rname = toStringSafe(j.name) ?? ""

  let image: CgCoinImage | null = null
  if (isPlainObject(j.image)) {
    image = {
      thumb: toStringSafe(j.image.thumb) ?? null,
      small: toStringSafe(j.image.small) ?? null,
      large: toStringSafe(j.image.large) ?? null,
    }
  }

  const out: CgCoinMeta = { id: rid, symbol: rsymbol, name: rname, image }

  setCache(cacheKey, out, 24 * 60 * 60 * 1000)

  return out
}

export async function cgCoinMetaByIdSafe(
  id: string
): Promise<
  | { ok: true; id: string; symbol: string; name: string; imageUrl: string | null }
  | { ok: false; error: string }
> {
  try {
    const m = await cgCoinMetaById(id)
    const imageUrl = m.image?.small ?? m.image?.thumb ?? m.image?.large ?? null
    return { ok: true, id: m.id, symbol: m.symbol, name: m.name, imageUrl }
  } catch (e: unknown) {
    return { ok: false, error: e instanceof Error ? e.message : "Unknown error" }
  }
}

type CgSimplePriceResponse = Record<
  string,
  {
    usd?: unknown
    usd_24h_change?: unknown
  }
>

export async function cgPriceUsdById(id: string): Promise<CgPrice> {
  const coinId = normalizeIdCandidate(id)

  const cacheKey = `cg:price:${coinId}`
  const cached = getCache<CgPrice>(cacheKey)
  if (cached) return cached

  const url =
    `${baseUrl()}/simple/price?ids=${encodeURIComponent(coinId)}` +
    `&vs_currencies=usd&include_24hr_change=true`

  const res = await cgFetch(url)
  if (!res.ok) throw new Error(`CoinGecko /simple/price HTTP ${res.status}`)

  const j = (await res.json()) as unknown
  if (!isPlainObject(j)) throw new Error("Invalid price response")

  const rowUnknown = (j as Record<string, unknown>)[coinId]
  if (!isPlainObject(rowUnknown)) throw new Error(`No price data for id=${coinId}`)

  const row = rowUnknown as CgSimplePriceResponse[string]

  const usd = toNumberSafe(row.usd)
  const chg = toNumberSafe(row.usd_24h_change)

  if (usd == null || usd <= 0) throw new Error("Invalid USD price")

  const out: CgPrice = { id: coinId, priceUsd: usd, change24hPct: chg != null ? chg : null }

  setCache(cacheKey, out, 20_000)

  return out
}

export async function cgPriceUsdByIdSafe(
  id: string
): Promise<
  | { ok: true; id: string; priceUsd: number; change24hPct: number | null }
  | { ok: false; error: string }
> {
  try {
    const p = await cgPriceUsdById(id)
    return { ok: true, id: p.id, priceUsd: p.priceUsd, change24hPct: p.change24hPct }
  } catch (e: unknown) {
    return { ok: false, error: e instanceof Error ? e.message : "Unknown error" }
  }
}

export async function cgNormalizeOrResolveCoinId(params: {
  assetId: string
  assetSymbol: string
}): Promise<string | null> {
  const rawId = params.assetId.trim()
  const rawSym = params.assetSymbol.trim()

  if (!rawId && !rawSym) return null

  const idCandidate = normalizeIdCandidate(rawId)
  const looksLikeId =
    idCandidate.length >= 6 || idCandidate.includes("-") || /[0-9]/.test(idCandidate)

  if (rawId && looksLikeId) return idCandidate

  const symbol = rawSym || rawId
  const resolved = await cgResolveIdFromSymbol(symbol)
  return resolved ? normalizeIdCandidate(resolved) : null
}

type CgMarketsResponse = unknown

export async function cgTopByMarketCap(limit = 6): Promise<CgMarketCoin[]> {
  const perPage = clampInt(limit, 1, 250)

  const cacheKey = `cg:top:${perPage}`
  const cached = getCache<CgMarketCoin[]>(cacheKey)
  if (cached) return cached

  const url =
    `${baseUrl()}/coins/markets` +
    `?vs_currency=usd&order=market_cap_desc&per_page=${perPage}&page=1&sparkline=false` +
    `&price_change_percentage=24h`

  const res = await cgFetch(url)
  if (!res.ok) throw new Error(`CoinGecko /coins/markets HTTP ${res.status}`)

  const j = (await res.json()) as CgMarketsResponse
  if (!Array.isArray(j)) throw new Error("Invalid markets response")

  const out: CgMarketCoin[] = []

  for (const item of j) {
    if (!isPlainObject(item)) continue

    const id = toStringSafe(item.id) ?? ""
    const symbol = toStringSafe(item.symbol) ?? ""
    const name = toStringSafe(item.name) ?? ""
    const image = toStringSafe(item.image) ?? null

    const currentPrice = toNumberSafe(item.current_price)
    const pct24 = toNumberSafe(item.price_change_percentage_24h)
    const rank = toNumberSafe(item.market_cap_rank)

    if (!id || !symbol) continue

    out.push({
      id,
      symbol,
      name,
      image,
      current_price: currentPrice,
      price_change_percentage_24h: pct24,
      market_cap_rank: rank,
    })
  }

  setCache(cacheKey, out, 60_000)

  return out
}
