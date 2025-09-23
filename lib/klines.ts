export type Candle = {
  openTime: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  closeTime: number;
};

export type BinanceInterval = "1h" | "4h" | "1d";

const HOSTS = [
  process.env.BINANCE_API_URL ?? "https://api.binance.com",
  "https://api1.binance.com",
  "https://api2.binance.com",
  "https://api3.binance.com",
  "https://data-api.binance.vision",
];

export async function fetchKlines(
  symbol: string,
  interval: BinanceInterval,
  limit = 150
): Promise<Candle[]> {
  const path = `/api/v3/klines?symbol=${encodeURIComponent(symbol)}&interval=${interval}&limit=${limit}`;
  let lastErr: unknown = null;

  for (const host of HOSTS) {
    try {
      const url = `${host}${path}`;
      const res = await fetch(url, { cache: "no-store" });

      if (res.status === 451) {
        lastErr = new Error(`HTTP 451 (blocked) em ${host}`);
        continue;
      }
      if (!res.ok) {
        lastErr = new Error(`HTTP ${res.status} em ${host}`);
        continue;
      }

      const json: unknown = await res.json();
      if (!Array.isArray(json)) throw new Error("Invalid klines response");

      return json.map((rowUnknown) => {
        if (!Array.isArray(rowUnknown)) throw new Error("Invalid kline row");
        const row = rowUnknown as (string | number)[];
        return {
          openTime: Number(row[0]),
          open: Number(row[1]),
          high: Number(row[2]),
          low: Number(row[3]),
          close: Number(row[4]),
          volume: Number(row[5]),
          closeTime: Number(row[6]),
        };
      });
    } catch (err) {
      lastErr = err;
      continue;
    }
  }

  throw new Error(
    `Falha ao obter klines para ${symbol} ${interval}. Último erro: ${String(lastErr)}`
  );
}
