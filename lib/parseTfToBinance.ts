import type { BinanceInterval } from "@/lib/klines";

export function parseTfToBinance(tfCode: string): BinanceInterval {
  const s = tfCode.trim().toLowerCase();
  const map: Record<string, BinanceInterval> = {
    "1m": "1m", "3m": "3m", "5m": "5m", "15m": "15m", "30m": "30m",
    "1h": "1h", "2h": "2h", "4h": "4h", "6h": "6h", "8h": "8h", "12h": "12h",
    "1d": "1d", "3d": "3d", "1w": "1w",
    "1mo": "1M", "1mth": "1M", "1month": "1M",
  };
  if (map[s]) return map[s];
  throw new Error(`Invalid timeframe: ${tfCode}`);
}
