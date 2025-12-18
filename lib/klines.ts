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

/**
 * Fetch historical candlestick (kline) data from Binance.
 *
 * @param symbol - Trading pair symbol (e.g., "BTCUSDT")
 * @param interval - Time interval for each candle (e.g., "1h", "1d", "1M")
 * @param limit - Number of candles to fetch (default: 150)
 * @returns Array of Candle objects
 * @throws Error if all Binance endpoints fail
 */
export async function fetchKlines(
  symbol: string,
  interval: BinanceInterval,
  limit = 150
): Promise<Candle[]> {
  const path = `/api/v3/klines?symbol=${encodeURIComponent(symbol)}&interval=${interval}&limit=${limit}`
  let lastErr: unknown = null

  for (const host of HOSTS) {
    try {
      const url = `${host}${path}`
      const res = await fetch(url, { cache: "no-store" })

      if (res.status === 451) {
        lastErr = new Error(`HTTP 451 (region blocked) from ${host}`)
        continue
      }
      if (!res.ok) {
        lastErr = new Error(`HTTP ${res.status} from ${host}`)
        continue
      }

      const json: unknown = await res.json()
      if (!Array.isArray(json)) throw new Error("Invalid klines response")

      return json.map((rowUnknown) => {
        if (!Array.isArray(rowUnknown)) throw new Error("Invalid kline row")
        const row = rowUnknown as (string | number)[]
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
    } catch (err) {
      lastErr = err
      continue
    }
  }

  throw new Error(
    `Failed to fetch klines for ${symbol} ${interval}. Last error: ${String(lastErr)}`
  )
}

type BinanceTickerPrice = { symbol: string; price: string }

/**
 * Fetch current price from Binance ticker/price endpoint.
 *
 * @param symbol - Trading pair symbol (e.g., "BTCUSDT")
 * @returns current price as number
 * @throws Error if all Binance endpoints fail
 */
export async function fetchTickerPrice(symbol: string): Promise<number> {
  const path = `/api/v3/ticker/price?symbol=${encodeURIComponent(symbol)}`
  let lastErr: unknown = null

  for (const host of HOSTS) {
    try {
      const url = `${host}${path}`
      const res = await fetch(url, { cache: "no-store" })

      if (res.status === 451) {
        lastErr = new Error(`HTTP 451 (region blocked) from ${host}`)
        continue
      }
      if (!res.ok) {
        lastErr = new Error(`HTTP ${res.status} from ${host}`)
        continue
      }

      const json = (await res.json()) as BinanceTickerPrice
      const price = Number(json?.price)

      if (!Number.isFinite(price) || price <= 0) {
        throw new Error("Invalid ticker price response")
      }

      return price
    } catch (err) {
      lastErr = err
      continue
    }
  }

  throw new Error(
    `Failed to fetch ticker price for ${symbol}. Last error: ${String(lastErr)}`
  )
}
