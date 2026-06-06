import { beforeEach, describe, expect, it, vi } from "vitest"

const {
  getServerSessionMock,
  migrateLegacyPortfolioTradesMock,
  findFirstMock,
  updateSpotTransactionMock,
  deleteSpotTransactionMock,
  deleteAssetExitStrategiesIfNoHoldingMock,
  ensureDefaultExitStrategyForAssetMock,
  getOpenSpotHoldingMock,
} = vi.hoisted(() => ({
  getServerSessionMock: vi.fn(),
  migrateLegacyPortfolioTradesMock: vi.fn(),
  findFirstMock: vi.fn(),
  updateSpotTransactionMock: vi.fn(),
  deleteSpotTransactionMock: vi.fn(),
  deleteAssetExitStrategiesIfNoHoldingMock: vi.fn(),
  ensureDefaultExitStrategyForAssetMock: vi.fn(),
  getOpenSpotHoldingMock: vi.fn(),
}))

vi.mock("next-auth", () => ({
  getServerSession: getServerSessionMock,
}))

vi.mock("@/lib/auth", () => ({
  authOptions: {},
}))

vi.mock("@/services/portfolio-legacy-migration.service", () => ({
  migrateLegacyPortfolioTrades: migrateLegacyPortfolioTradesMock,
}))

vi.mock("@/lib/prisma", () => ({
  prisma: {
    portfolio_trade: {
      findFirst: findFirstMock,
    },
  },
}))

vi.mock("@/data/repositories/portfolio.repo.v2", () => ({
  PortfolioRepoV2: {
    updateSpotTransaction: updateSpotTransactionMock,
    deleteSpotTransaction: deleteSpotTransactionMock,
  },
}))

vi.mock("@/services/exit-strategy.service", () => ({
  deleteAssetExitStrategiesIfNoHolding: deleteAssetExitStrategiesIfNoHoldingMock,
  ensureDefaultExitStrategyForAsset: ensureDefaultExitStrategyForAssetMock,
}))

vi.mock("@/services/portfolio-holdings.service", () => ({
  getOpenSpotHolding: getOpenSpotHoldingMock,
}))

import {
  DELETE,
  PUT,
} from "@/app/api/portfolio/transaction/[id]/route"

describe("/api/portfolio/transaction/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    getServerSessionMock.mockResolvedValue({ accountId: "acc_1" })
    migrateLegacyPortfolioTradesMock.mockResolvedValue(undefined)
    findFirstMock.mockResolvedValue({ asset_name: "BNB" })
    updateSpotTransactionMock.mockResolvedValue(true)
    deleteSpotTransactionMock.mockResolvedValue(true)
    deleteAssetExitStrategiesIfNoHoldingMock.mockResolvedValue(undefined)
    ensureDefaultExitStrategyForAssetMock.mockResolvedValue(undefined)
    getOpenSpotHoldingMock.mockResolvedValue({
      symbol: "BNB",
      qty: 1,
      investedUsd: 500,
      avgEntryPriceUsd: 500,
    })
  })

  it("updates a transaction using promised route params", async () => {
    const response = await PUT(
      new Request("http://localhost/api/portfolio/transaction/tx_1", {
        method: "PUT",
        body: JSON.stringify({
          side: "buy",
          qty: 1,
          priceUsd: 600,
          feeUsd: 0,
          executedAt: "2026-06-06T12:00:00.000Z",
        }),
      }),
      { params: Promise.resolve({ id: "tx_1" }) },
    )

    expect(response.status).toBe(200)
    expect(updateSpotTransactionMock).toHaveBeenCalledWith(
      expect.objectContaining({
        accountId: "acc_1",
        tradeId: "tx_1",
        side: "buy",
        qty: 1,
        priceUsd: 600,
      }),
    )
    expect(ensureDefaultExitStrategyForAssetMock).toHaveBeenCalledWith(
      "acc_1",
      "BNB",
    )
  })

  it("deletes a transaction using promised route params", async () => {
    const response = await DELETE(
      new Request("http://localhost/api/portfolio/transaction/tx_1", {
        method: "DELETE",
      }),
      { params: Promise.resolve({ id: "tx_1" }) },
    )

    expect(response.status).toBe(200)
    expect(deleteSpotTransactionMock).toHaveBeenCalledWith({
      accountId: "acc_1",
      tradeId: "tx_1",
    })
    expect(deleteAssetExitStrategiesIfNoHoldingMock).toHaveBeenCalledWith(
      "acc_1",
      "BNB",
    )
  })
})
