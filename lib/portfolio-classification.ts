export type PortfolioAllocationCategory =
  | "btc"
  | "eth"
  | "large"
  | "mid"
  | "small"
  | "stable";

const STABLECOIN_SYMBOLS = new Set(["USDT", "USDC", "DAI", "TUSD", "USDP"]);

const LARGE_CAP_FALLBACK_SYMBOLS = new Set([
  "ADA",
  "AVAX",
  "BNB",
  "DOGE",
  "DOT",
  "HYPE",
  "LINK",
  "SOL",
  "SUI",
  "TON",
  "TRX",
  "XLM",
  "XRP",
]);

const MID_CAP_FALLBACK_SYMBOLS = new Set([
  "AAVE",
  "ARB",
  "ATOM",
  "BCH",
  "FIL",
  "ICP",
  "INJ",
  "LTC",
  "NEAR",
  "OP",
  "POL",
  "UNI",
]);

export function classifyPortfolioAsset(asset: {
  symbol: string;
  marketCapUsd?: number | null;
  isStablecoin?: boolean;
}): PortfolioAllocationCategory {
  const symbol = asset.symbol.trim().toUpperCase();

  if (asset.isStablecoin || STABLECOIN_SYMBOLS.has(symbol)) return "stable";
  if (symbol === "BTC") return "btc";
  if (symbol === "ETH") return "eth";

  const marketCap = Number(asset.marketCapUsd ?? 0);
  if (Number.isFinite(marketCap) && marketCap > 0) {
    if (marketCap > 10_000_000_000) return "large";
    if (marketCap >= 1_000_000_000) return "mid";
    return "small";
  }

  if (LARGE_CAP_FALLBACK_SYMBOLS.has(symbol)) return "large";
  if (MID_CAP_FALLBACK_SYMBOLS.has(symbol)) return "mid";

  return "mid";
}
