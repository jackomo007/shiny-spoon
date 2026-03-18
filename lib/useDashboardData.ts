import { useState, useEffect } from "react";

type PortfolioData = {
  summary: {
    currentBalanceUsd: number;
    profit: {
      total: { usd: number; pct: number };
    };
    portfolio24h: { pct: number; usd: number };
  };
  assets: Array<{
    symbol: string;
    name: string | null;
    priceUsd: number;
    change24hPct: number | null;
    holdingsValueUsd: number;
    qtyHeld: number;
  }>;
};

type MarketGlobalData = {
  totalMarketCap: {
    usd: number;
    change24hPct: number;
    formatted: string;
  };
  dominance: {
    btc: number;
    eth: number;
  };
};

type FearGreedData = {
  current: {
    score: number;
    label: string;
    description: string;
    narrative: string;
  };
  history: {
    change7d: number | null;
  };
};

type MarketAnalysisData = {
  analysis: {
    sentiment: "Bullish" | "Bearish" | "Neutral";
    marketTrend: string;
    phase: string;
    support: string;
    resistance: string;
    structure: string;
    dashboardSummary: {
      bullishConfirmation: string;
      neutralRange: string;
      bearishBreakdown: string;
    };
  };
  meta: {
    generatedAt: string;
    scheduledRefresh: string;
    scheduleTimezone: string;
    refreshBucket: string;
    source: string;
    method: "ai";
    currentTotalMarketCap: string;
    basedOn: string[];
    isEstimated?: boolean;
  };
};

type BtcLevelsData = {
  current: {
    price: number;
  };
  keyLevels: {
    breakoutLevel: number;
    breakdownLevel: number;
  };
  levels: {
    resistances: Array<{
      price: number;
      level: string;
      type: "resistance";
      strength: "weak" | "medium" | "strong";
    }>;
    supports: Array<{
      price: number;
      level: string;
      type: "support";
      strength: "weak" | "medium" | "strong";
    }>;
  };
};

type AssetPriceData = {
  priceUsd: number;
  change24hPct: number;
};

type DashboardData = {
  portfolio: PortfolioData | null;
  marketGlobal: MarketGlobalData | null;
  fearGreed: FearGreedData | null;
  marketAnalysis: MarketAnalysisData | null;
  btcLevels: BtcLevelsData | null;
  btcPrice: AssetPriceData | null;
  ethPrice: AssetPriceData | null;
  loading: boolean;
  error: string | null;
};

export function useDashboardData(): DashboardData {
  const [data, setData] = useState<DashboardData>({
    portfolio: null,
    marketGlobal: null,
    fearGreed: null,
    marketAnalysis: null,
    btcLevels: null,
    btcPrice: null,
    ethPrice: null,
    loading: true,
    error: null,
  });

  useEffect(() => {
    let cancelled = false;

    async function fetchAllData() {
      try {
        setData((prev) => ({ ...prev, loading: true, error: null }));

        const [
          portfolioRes,
          marketGlobalRes,
          fearGreedRes,
          marketAnalysisRes,
          btcLevelsRes,
        ] = await Promise.allSettled([
          fetch("/api/portfolio"),
          fetch("/api/market/global"),
          fetch("/api/market/fear-greed"),
          fetch("/api/market/analysis"),
          fetch("/api/market/btc-levels"),
        ]);

        if (cancelled) return;

        let portfolioData: PortfolioData | null = null;
        if (portfolioRes.status === "fulfilled" && portfolioRes.value.ok) {
          portfolioData = await portfolioRes.value.json();
        }

        let marketGlobalData: MarketGlobalData | null = null;
        if (
          marketGlobalRes.status === "fulfilled" &&
          marketGlobalRes.value.ok
        ) {
          marketGlobalData = await marketGlobalRes.value.json();
        }

        let fearGreedData: FearGreedData | null = null;
        if (fearGreedRes.status === "fulfilled" && fearGreedRes.value.ok) {
          fearGreedData = await fearGreedRes.value.json();
        }

        let marketAnalysisData: MarketAnalysisData | null = null;
        if (
          marketAnalysisRes.status === "fulfilled" &&
          marketAnalysisRes.value.ok
        ) {
          marketAnalysisData = await marketAnalysisRes.value.json();
        }

        let btcLevelsData: BtcLevelsData | null = null;
        if (btcLevelsRes.status === "fulfilled" && btcLevelsRes.value.ok) {
          btcLevelsData = await btcLevelsRes.value.json();
        }

        let btcPriceData: AssetPriceData | null = null;
        let ethPriceData: AssetPriceData | null = null;

        if (portfolioData?.assets) {
          const btcAsset = portfolioData.assets.find(
            (asset) => asset.symbol === "BTC",
          );
          const ethAsset = portfolioData.assets.find(
            (asset) => asset.symbol === "ETH",
          );

          if (btcAsset) {
            btcPriceData = {
              priceUsd: btcAsset.priceUsd,
              change24hPct: btcAsset.change24hPct ?? 0,
            };
          }

          if (ethAsset) {
            ethPriceData = {
              priceUsd: ethAsset.priceUsd,
              change24hPct: ethAsset.change24hPct ?? 0,
            };
          }
        }

        if (!btcPriceData || !ethPriceData) {
          const [btcRes, ethRes] = await Promise.allSettled([
            !btcPriceData
              ? fetch("/api/portfolio/assets/price?id=bitcoin")
              : null,
            !ethPriceData
              ? fetch("/api/portfolio/assets/price?id=ethereum")
              : null,
          ]);

          if (
            !btcPriceData &&
            btcRes?.status === "fulfilled" &&
            btcRes.value?.ok
          ) {
            btcPriceData = await btcRes.value.json();
          }

          if (
            !ethPriceData &&
            ethRes?.status === "fulfilled" &&
            ethRes.value?.ok
          ) {
            ethPriceData = await ethRes.value.json();
          }
        }

        if (!cancelled) {
          setData({
            portfolio: portfolioData,
            marketGlobal: marketGlobalData,
            fearGreed: fearGreedData,
            marketAnalysis: marketAnalysisData,
            btcLevels: btcLevelsData,
            btcPrice: btcPriceData,
            ethPrice: ethPriceData,
            loading: false,
            error: null,
          });
        }
      } catch (error) {
        if (!cancelled) {
          console.error("Dashboard data fetch error:", error);
          setData((prev) => ({
            ...prev,
            loading: false,
            error: "Failed to load dashboard data",
          }));
        }
      }
    }

    fetchAllData();

    return () => {
      cancelled = true;
    };
  }, []);

  return data;
}
