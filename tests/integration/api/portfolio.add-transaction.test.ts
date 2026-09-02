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

  it("derives quantity from gross total without subtracting the buy fee", async () => {
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
        qty: 4500 / 59,
        priceUsd: 59,
        feeUsd: 17.86,
      }),
    )
  })

  it("creates an automatic buy transaction from net sell proceeds when converting", async () => {
    getOpenSpotHoldingMock.mockReset()
    getOpenSpotHoldingMock
      .mockResolvedValueOnce({
        symbol: "ETH",
        qty: 2,
        investedUsd: 4000,
        avgEntryPriceUsd: 2000,
      })
      .mockResolvedValueOnce(null)
    findUniqueMock.mockImplementation(({ where }: { where: { symbol: string } }) => {
      if (where.symbol === "ETH") {
        return Promise.resolve({
          coingecko_id: "ethereum",
          name: "Ethereum",
          image_url: "https://example.com/eth.png",
        })
      }

      return Promise.resolve({
        coingecko_id: "tether",
        name: "Tether",
        image_url: "https://example.com/usdt.png",
      })
    })
    cgPriceUsdByIdMock.mockImplementation((id: string) => {
      if (id === "tether") {
        return Promise.resolve({ priceUsd: 1, change24hPct: 0 })
      }

      return Promise.resolve({ priceUsd: 3000, change24hPct: 2 })
    })

    const response = await POST(
      new Request("http://localhost/api/portfolio/add-transaction", {
        method: "POST",
        body: JSON.stringify({
          asset: { id: "ethereum", symbol: "ETH", name: "Ethereum" },
          side: "sell",
          priceMode: "custom",
          priceUsd: 3000,
          qty: 1.5,
          feeUsd: 2,
          executedAt: "2026-06-26T12:00:00.000Z",
          convertProceeds: {
            enabled: true,
            asset: { id: "tether", symbol: "USDT", name: "Tether" },
          },
        }),
      }),
    )

    expect(response.status).toBe(200)
    expect(createSpotTransactionMock).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        accountId: "acc_1",
        symbol: "ETH",
        side: "sell",
        qty: 1.5,
        priceUsd: 3000,
        feeUsd: 2,
      }),
    )
    expect(createSpotTransactionMock).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        accountId: "acc_1",
        symbol: "USDT",
        side: "buy",
        qty: 4498,
        priceUsd: 1,
        feeUsd: 0,
        chainId: "ethereum",
      }),
    )
    expect(setPortfolioAssetStablecoinMock).toHaveBeenCalledWith({
      accountId: "acc_1",
      symbol: "USDT",
      isStablecoin: true,
    })
  })
})
