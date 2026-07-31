"use client";

import type { AssetRow } from "@/components/portfolio/AssetsTable";
import {
  getPortfolioChainInfo,
  type PortfolioChainOption,
} from "@/lib/portfolio-chains";

export type ChainInfo = PortfolioChainOption;

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

function safeValue(asset: AssetRow) {
  const holdingsValue =
    Number.isFinite(asset.holdingsValueUsd) && asset.holdingsValueUsd > 0
      ? asset.holdingsValueUsd
      : asset.totalInvestedUsd;
  return Number.isFinite(holdingsValue) && holdingsValue > 0
    ? holdingsValue
    : 0;
}

export function getAssetChainInfo(
  asset: Pick<AssetRow, "symbol" | "chainId">,
): ChainInfo {
  return getPortfolioChainInfo(asset.chainId, asset.symbol);
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
