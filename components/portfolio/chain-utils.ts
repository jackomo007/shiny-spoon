"use client";

import type { AssetRow } from "@/components/portfolio/AssetsTable";

export type ChainInfo = {
  id: string;
  name: string;
  symbol: string;
  color: string;
  accentClass: string;
};

export type ChainAssetRow = AssetRow & {
  chain: ChainInfo;
};

export type ChainAllocationRow = {
  chain: ChainInfo;
  assets: ChainAssetRow[];
  valueUsd: number;
  investedUsd: number;
  profitUsd: number;
  percent: number;
  change24hPct: number | null;
};

const CHAINS: Record<string, ChainInfo> = {
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
  xrp: {
    id: "xrp",
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
  other: {
    id: "other",
    name: "Other Chain",
    symbol: "OTHER",
    color: "#8B5CF6",
    accentClass: "from-purple-400 to-fuchsia-500",
  },
};

const SYMBOL_TO_CHAIN: Record<string, keyof typeof CHAINS> = {
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
  XRP: "xrp",
  ADA: "cardano",
};

function safeValue(asset: AssetRow) {
  const holdingsValue =
    Number.isFinite(asset.holdingsValueUsd) && asset.holdingsValueUsd > 0
      ? asset.holdingsValueUsd
      : asset.totalInvestedUsd;
  return Number.isFinite(holdingsValue) && holdingsValue > 0
    ? holdingsValue
    : 0;
}

export function getAssetChainInfo(asset: Pick<AssetRow, "symbol">): ChainInfo {
  const symbol = (asset.symbol ?? "").trim().toUpperCase();
  return CHAINS[SYMBOL_TO_CHAIN[symbol] ?? "other"];
}

export function buildChainAllocation(assets: AssetRow[]): ChainAllocationRow[] {
  const grouped = new Map<string, ChainAllocationRow>();

  for (const asset of assets) {
    const chain = getAssetChainInfo(asset);
    const valueUsd = safeValue(asset);
    if (valueUsd <= 0) continue;

    const current = grouped.get(chain.id) ?? {
      chain,
      assets: [],
      valueUsd: 0,
      investedUsd: 0,
      profitUsd: 0,
      percent: 0,
      change24hPct: null,
    };

    current.assets.push({ ...asset, chain });
    current.valueUsd += valueUsd;
    current.investedUsd += Number.isFinite(asset.totalInvestedUsd)
      ? asset.totalInvestedUsd
      : 0;
    current.profitUsd += Number.isFinite(asset.currentProfitUsd)
      ? asset.currentProfitUsd
      : 0;
    grouped.set(chain.id, current);
  }

  const total = Array.from(grouped.values()).reduce(
    (sum, row) => sum + row.valueUsd,
    0,
  );

  return Array.from(grouped.values())
    .map((row) => {
      const weightedChange = row.assets.reduce((sum, asset) => {
        const valueUsd = safeValue(asset);
        const change = asset.change24hPct ?? 0;
        return sum + (total > 0 ? (valueUsd / row.valueUsd) * change : 0);
      }, 0);

      return {
        ...row,
        assets: row.assets.sort((a, b) => safeValue(b) - safeValue(a)),
        percent: total > 0 ? (row.valueUsd / total) * 100 : 0,
        change24hPct: Number.isFinite(weightedChange) ? weightedChange : null,
      };
    })
    .sort((a, b) => b.valueUsd - a.valueUsd);
}

