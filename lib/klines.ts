export type Candle = {
  openTime: number
  open: number
  high: number
  low: number
  close: number
  volume: number
  closeTime: number
}

export type BinanceInterval =
  | "1m" | "3m" | "5m" | "15m" | "30m"
  | "1h" | "2h" | "4h" | "6h" | "8h" | "12h"
  | "1d" | "3d" | "1w" | "1M"

const HOSTS = [
  process.env.BINANCE_API_URL ?? "https://api.binance.com",
  "https://api1.binance.com",
  "https://api2.binance.com",
  "https://api3.binance.com",
  "https://data-api.binance.vision",
]

async function fetchFromBinance(path: string) {
  let lastErr: unknown = null

  for (const host of HOSTS) {
    try {
      const res = await fetch(`${host}${path}`, { cache: "no-store" })

      if (res.status === 451) {
        lastErr = new Error(`HTTP 451 (region blocked) from ${host}`)
        continue
      }

      if (!res.ok) {
        lastErr = new Error(`HTTP ${res.status} from ${host}`)
        continue
      }

      return res
    } catch (err) {
      lastErr = err
    }
  }

  throw new Error(`Binance request failed. Last error: ${String(lastErr)}`)
}

/**
 * Fetch historical candlestick (kline) data from Binance.
 */
export async function fetchKlines(
  symbol: string,
  interval: BinanceInterval,
  limit = 150
): Promise<Candle[]> {
  const path =
    `/api/v3/klines?symbol=${encodeURIComponent(symbol)}` +
    `&interval=${interval}&limit=${limit}`

  const res = await fetchFromBinance(path)
  const json: unknown = await res.json()

  if (!Array.isArray(json)) {
    throw new Error("Invalid klines response")
  }

  return json.map((row) => {
    if (!Array.isArray(row)) throw new Error("Invalid kline row")

    return {
      openTime: Number(row[0]),
      open: Number(row[1]),
      high: Number(row[2]),
      low: Number(row[3]),
      close: Number(row[4]),
      volume: Number(row[5]),
      closeTime: Number(row[6]),
    }
  })
}

type BinanceTickerPrice = {
  symbol: string
  price: string
}

/**
 * Fetch current ticker price from Binance.
 * Throws if symbol does not exist or price is invalid.
 */
export async function fetchTickerPrice(symbol: string): Promise<number> {
  const path = `/api/v3/ticker/price?symbol=${encodeURIComponent(symbol)}`
  const res = await fetchFromBinance(path)

  const json = (await res.json()) as BinanceTickerPrice
  const price = Number(json?.price)

  if (!Number.isFinite(price) || price <= 0) {
    throw new Error(`Invalid ticker price for ${symbol}`)
  }

  return price
}
