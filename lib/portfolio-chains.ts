export type PortfolioChainOption = {
  id: string;
  name: string;
  symbol: string;
  color: string;
  accentClass: string;
};

export const PORTFOLIO_CHAINS: Record<string, PortfolioChainOption> = {
  bitcoin: {
    id: "bitcoin",
    name: "Bitcoin",
    symbol: "BTC",
    color: "#F59E0B",
    accentClass: "from-amber-400 to-orange-500",
  },
  ethereum: {
    id: "ethereum",
    name: "Ethereum",
    symbol: "ETH",
    color: "#5A67D8",
    accentClass: "from-indigo-500 to-violet-500",
  },
  solana: {
    id: "solana",
    name: "Solana",
    symbol: "SOL",
    color: "#17B897",
    accentClass: "from-emerald-400 to-teal-500",
  },
  hyperliquid: {
    id: "hyperliquid",
    name: "Hyperliquid",
    symbol: "HYPE",
    color: "#109F91",
    accentClass: "from-teal-400 to-cyan-600",
  },
  sui: {
    id: "sui",
    name: "Sui",
    symbol: "SUI",
    color: "#54A8F5",
    accentClass: "from-sky-400 to-blue-500",
  },
  "xrp-ledger": {
    id: "xrp-ledger",
    name: "XRP Ledger",
    symbol: "XRP",
    color: "#4B5563",
    accentClass: "from-slate-500 to-slate-700",
  },
  cardano: {
    id: "cardano",
    name: "Cardano",
    symbol: "ADA",
    color: "#2F7BC7",
    accentClass: "from-blue-500 to-indigo-600",
  },
  tron: {
    id: "tron",
    name: "Tron",
    symbol: "TRX",
    color: "#EF4444",
    accentClass: "from-red-500 to-rose-600",
  },
  "polygon-pos": {
    id: "polygon-pos",
    name: "Polygon",
    symbol: "POL",
    color: "#8247E5",
    accentClass: "from-purple-500 to-indigo-600",
  },
  "arbitrum-one": {
    id: "arbitrum-one",
    name: "Arbitrum",
    symbol: "ARB",
    color: "#28A0F0",
    accentClass: "from-sky-500 to-blue-600",
  },
  "optimistic-ethereum": {
    id: "optimistic-ethereum",
    name: "Optimism",
    symbol: "OP",
    color: "#FF0420",
    accentClass: "from-red-500 to-orange-500",
  },
  avalanche: {
    id: "avalanche",
    name: "Avalanche",
    symbol: "AVAX",
    color: "#E84142",
    accentClass: "from-red-500 to-pink-600",
  },
  "binance-smart-chain": {
    id: "binance-smart-chain",
    name: "BNB Smart Chain",
    symbol: "BNB",
    color: "#F0B90B",
    accentClass: "from-yellow-400 to-amber-500",
  },
  base: {
    id: "base",
    name: "Base",
    symbol: "BASE",
    color: "#0052FF",
    accentClass: "from-blue-500 to-indigo-600",
  },
  other: {
    id: "other",
    name: "Other Chain",
    symbol: "OTHER",
    color: "#8B5CF6",
    accentClass: "from-purple-400 to-fuchsia-500",
  },
};

const SYMBOL_TO_DEFAULT_CHAIN: Record<string, string> = {
  BTC: "bitcoin",
  WBTC: "bitcoin",
  ETH: "ethereum",
  WETH: "ethereum",
  USDT: "ethereum",
  USDC: "ethereum",
  DAI: "ethereum",
  LINK: "ethereum",
  UNI: "ethereum",
  AAVE: "ethereum",
  PEPE: "ethereum",
  SHIB: "ethereum",
  SOL: "solana",
  BONK: "solana",
  JUP: "solana",
  RAY: "solana",
  HYPE: "hyperliquid",
  SUI: "sui",
  XRP: "xrp-ledger",
  ADA: "cardano",
  TRX: "tron",
  MATIC: "polygon-pos",
  POL: "polygon-pos",
  ARB: "arbitrum-one",
  OP: "optimistic-ethereum",
  AVAX: "avalanche",
  BNB: "binance-smart-chain",
};

const PLATFORM_ALIASES: Record<string, string> = {
  "xrp-ledger": "xrp-ledger",
  ripple: "xrp-ledger",
  "binance-smart-chain": "binance-smart-chain",
  "bnb-smart-chain": "binance-smart-chain",
  "polygon-pos": "polygon-pos",
  polygon: "polygon-pos",
  "arbitrum-one": "arbitrum-one",
  arbitrum: "arbitrum-one",
  "base": "base",
  "base-network": "base",
};

const COMMON_PORTFOLIO_CHAIN_IDS = [
  "ethereum",
  "solana",
  "bitcoin",
  "tron",
  "polygon-pos",
  "arbitrum-one",
  "optimistic-ethereum",
  "base",
  "avalanche",
  "binance-smart-chain",
  "xrp-ledger",
  "cardano",
  "sui",
  "hyperliquid",
];

export function normalizePortfolioChainId(chainId: string | null | undefined) {
  const id = String(chainId ?? "").trim().toLowerCase();
  if (!id) return null;
  return PLATFORM_ALIASES[id] ?? id;
}

export function getDefaultPortfolioChainId(symbol: string) {
  return SYMBOL_TO_DEFAULT_CHAIN[symbol.trim().toUpperCase()] ?? "other";
}

export function getPortfolioChainInfo(
  chainId: string | null | undefined,
  symbol?: string,
): PortfolioChainOption {
  const normalized = normalizePortfolioChainId(chainId);
  if (normalized && PORTFOLIO_CHAINS[normalized]) {
    return PORTFOLIO_CHAINS[normalized];
  }

  const fallbackId = symbol ? getDefaultPortfolioChainId(symbol) : "other";
  return PORTFOLIO_CHAINS[fallbackId] ?? PORTFOLIO_CHAINS.other;
}

export function buildPortfolioChainOptions(params: {
  symbol: string;
  platformIds?: string[];
}) {
  const seen = new Set<string>();
  const options: PortfolioChainOption[] = [];

  function add(id: string | null | undefined) {
    const normalized = normalizePortfolioChainId(id);
    if (!normalized || seen.has(normalized)) return;
    const chain = PORTFOLIO_CHAINS[normalized];
    if (!chain) return;
    seen.add(normalized);
    options.push(chain);
  }

  add(getDefaultPortfolioChainId(params.symbol));
  for (const platformId of params.platformIds ?? []) add(platformId);
  for (const chainId of COMMON_PORTFOLIO_CHAIN_IDS) add(chainId);
  add("other");

  return options;
}
