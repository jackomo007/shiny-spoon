export type PortfolioAllocationCategory =
  | "btc"
  | "eth"
  | "large"
  | "mid"
  | "small"
  | "stable";

const STABLECOIN_SYMBOLS = new Set(["USDT", "USDC", "DAI", "TUSD", "USDP"]);

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

  return "mid";
}
