import { describe, expect, it } from "vitest";
import { buildChainAllocation } from "@/components/portfolio/chain-utils";
import type { AssetRow } from "@/components/portfolio/AssetsTable";
import { buildPortfolioChainOptions } from "@/lib/portfolio-chains";

function asset(overrides: Partial<AssetRow> & Pick<AssetRow, "symbol">): AssetRow {
  return {
    symbol: overrides.symbol,
    name: overrides.name ?? overrides.symbol,
    coingeckoId: null,
    iconUrl: null,
    priceUsd: overrides.priceUsd ?? 1,
    change24hPct: overrides.change24hPct ?? null,
    totalInvestedUsd: overrides.totalInvestedUsd ?? 0,
    avgPriceUsd: overrides.avgPriceUsd ?? 1,
    qtyHeld: overrides.qtyHeld ?? 1,
    holdingsValueUsd: overrides.holdingsValueUsd ?? 0,
    currentProfitUsd: overrides.currentProfitUsd ?? 0,
    currentProfitPct: overrides.currentProfitPct ?? null,
    isStablecoin: overrides.isStablecoin,
    marketCapUsd: overrides.marketCapUsd,
  };
}

describe("buildChainAllocation", () => {
  it("groups current asset values by mapped chain", () => {
    const rows = buildChainAllocation([
      asset({ symbol: "ETH", holdingsValueUsd: 1200, currentProfitUsd: 200 }),
      asset({ symbol: "USDT", holdingsValueUsd: 300, currentProfitUsd: 0 }),
      asset({ symbol: "SOL", holdingsValueUsd: 500, currentProfitUsd: -25 }),
    ]);

    expect(rows).toHaveLength(2);
    expect(rows[0].chain.name).toBe("Ethereum");
    expect(rows[0].valueUsd).toBe(1500);
    expect(rows[0].profitUsd).toBe(200);
    expect(rows[0].percent).toBe(75);
    expect(rows[1].chain.name).toBe("Solana");
  });

  it("places unknown symbols into Other Chain", () => {
    const rows = buildChainAllocation([
      asset({ symbol: "NEW", holdingsValueUsd: 100 }),
    ]);

    expect(rows[0].chain.name).toBe("Other Chain");
    expect(rows[0].chain.symbol).toBe("OTHER");
  });
});

describe("buildPortfolioChainOptions", () => {
  it("prefers CoinGecko platform chains, limits defaults, and supports search", () => {
    const platforms = [
      { id: "made-up-chain", name: "Made Up Chain", shortname: "MUC" },
      { id: "another-network", name: "Another Network", shortname: "AN" },
      { id: "third-network", name: "Third Network", shortname: "TN" },
      { id: "fourth-network", name: "Fourth Network", shortname: "FN" },
      { id: "fifth-network", name: "Fifth Network", shortname: "FIVE" },
      { id: "sixth-network", name: "Sixth Network", shortname: "SIX" },
    ];

    const defaults = buildPortfolioChainOptions({
      symbol: "XYZ",
      platformIds: ["made-up-chain"],
      platforms,
    });

    expect(defaults).toHaveLength(5);
    expect(defaults[0]).toMatchObject({
      id: "made-up-chain",
      name: "Made Up Chain",
      symbol: "MUC",
    });

    const searched = buildPortfolioChainOptions({
      symbol: "XYZ",
      platformIds: ["made-up-chain"],
      platforms,
      query: "sixth",
    });

    expect(searched).toEqual([
      expect.objectContaining({ id: "sixth-network" }),
    ]);
  });
});
