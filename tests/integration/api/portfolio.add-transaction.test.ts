import { beforeEach, describe, expect, it, vi } from "vitest"

const {
  getServerSessionMock,
  createSpotTransactionMock,
  findUniqueMock,
  upsertMock,
  cgNormalizeOrResolveCoinIdMock,
  cgPriceUsdByIdMock,
  cgCoinMetaByIdSafeMock,
  ensureDefaultExitStrategyForAssetMock,
  deleteAssetExitStrategiesIfNoHoldingMock,
  getOpenSpotHoldingMock,
  setPortfolioAssetStablecoinMock,
} = vi.hoisted(() => ({
  getServerSessionMock: vi.fn(),
  createSpotTransactionMock: vi.fn(),
  findUniqueMock: vi.fn(),
  upsertMock: vi.fn(),
  cgNormalizeOrResolveCoinIdMock: vi.fn(),
  cgPriceUsdByIdMock: vi.fn(),
  cgCoinMetaByIdSafeMock: vi.fn(),
  ensureDefaultExitStrategyForAssetMock: vi.fn(),
  deleteAssetExitStrategiesIfNoHoldingMock: vi.fn(),
  getOpenSpotHoldingMock: vi.fn(),
  setPortfolioAssetStablecoinMock: vi.fn(),
}))

vi.mock("next-auth", () => ({
  getServerSession: getServerSessionMock,
}))

vi.mock("@/lib/auth", () => ({
  authOptions: {},
}))

vi.mock("@/data/repositories/portfolio.repo.v2", () => ({
  PortfolioRepoV2: {
    createSpotTransaction: createSpotTransactionMock,
  },
}))

vi.mock("@/lib/prisma", () => ({
  prisma: {
    verified_asset: {
      findUnique: findUniqueMock,
      upsert: upsertMock,
    },
  },
}))

vi.mock("@/lib/markets/coingecko", () => ({
  cgNormalizeOrResolveCoinId: cgNormalizeOrResolveCoinIdMock,
  cgPriceUsdById: cgPriceUsdByIdMock,
  cgCoinMetaByIdSafe: cgCoinMetaByIdSafeMock,
}))

vi.mock("@/services/exit-strategy.service", () => ({
  ensureDefaultExitStrategyForAsset: ensureDefaultExitStrategyForAssetMock,
  deleteAssetExitStrategiesIfNoHolding: deleteAssetExitStrategiesIfNoHoldingMock,
}))

vi.mock("@/services/portfolio-holdings.service", () => ({
  getOpenSpotHolding: getOpenSpotHoldingMock,
}))

vi.mock("@/services/portfolio-asset-settings.service", () => ({
  setPortfolioAssetStablecoin: setPortfolioAssetStablecoinMock,
}))

import { POST } from "@/app/api/portfolio/add-transaction/route"

describe("/api/portfolio/add-transaction", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    getServerSessionMock.mockResolvedValue({ accountId: "acc_1" })
    findUniqueMock.mockResolvedValue({
      coingecko_id: "hyperliquid",
      name: "Hyperliquid",
      image_url: "https://example.com/hype.png",
    })
    upsertMock.mockResolvedValue({ id: "asset_1" })
    cgNormalizeOrResolveCoinIdMock.mockResolvedValue("hyperliquid")
    cgPriceUsdByIdMock.mockResolvedValue({
      priceUsd: 59,
      change24hPct: 2,
    })
    cgCoinMetaByIdSafeMock.mockResolvedValue({
      ok: true,
      id: "hyperliquid",
      symbol: "hype",
      name: "Hyperliquid",
      imageUrl: "https://example.com/hype.png",
    })
    createSpotTransactionMock.mockResolvedValue("tx_1")
    ensureDefaultExitStrategyForAssetMock.mockResolvedValue(undefined)
    deleteAssetExitStrategiesIfNoHoldingMock.mockResolvedValue(undefined)
    getOpenSpotHoldingMock.mockResolvedValueOnce(null).mockResolvedValueOnce({
      symbol: "HYPE",
      qty: 1,
      investedUsd: 100,
      avgEntryPriceUsd: 100,
    })
    setPortfolioAssetStablecoinMock.mockResolvedValue(undefined)
  })

  it("subtracts buy fees from total before deriving quantity", async () => {
    const response = await POST(
      new Request("http://localhost/api/portfolio/add-transaction", {
        method: "POST",
        body: JSON.stringify({
          asset: { id: "hyperliquid", symbol: "HYPE", name: "Hyperliquid" },
          side: "buy",
          priceMode: "custom",
          priceUsd: 59,
          totalUsd: 4500,
          feeUsd: 17.86,
          executedAt: "2026-06-26T12:00:00.000Z",
        }),
      }),
    )

    expect(response.status).toBe(200)
    expect(createSpotTransactionMock).toHaveBeenCalledWith(
      expect.objectContaining({
        accountId: "acc_1",
        symbol: "HYPE",
        side: "buy",
        qty: (4500 - 17.86) / 59,
        priceUsd: 59,
        feeUsd: 17.86,
      }),
    )
  })
})
