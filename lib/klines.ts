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

export async function fetchKlines(
  symbol: string,
  interval: BinanceInterval,
  limit: number = 150
): Promise<Candle[]> {
  const base = process.env.BINANCE_API_URL ?? "https://api.binance.com";
  const url = `${base}/api/v3/klines?symbol=${encodeURIComponent(
    symbol
  )}&interval=${interval}&limit=${limit}`;

  const res: Response = await fetch(url, { cache: "no-store" });
  if (!res.ok) {
    throw new Error(`Binance HTTP ${res.status} for ${symbol} ${interval}`);
  }

  const json: unknown = await res.json();
  if (!Array.isArray(json)) {
    throw new Error("Invalid klines response");
  }

  const data: Candle[] = json.map((rowUnknown) => {
    if (!Array.isArray(rowUnknown)) {
      throw new Error("Invalid kline row");
    }
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

  return data;
}
