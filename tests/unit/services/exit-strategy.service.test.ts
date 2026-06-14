import { describe, expect, it, vi } from "vitest"

const {
  findFirstMock,
  findManyExecutionMock,
  findManyPortfolioTradeMock,
  getOpenSpotHoldingMock,
  getOpenSpotHoldingsMock,
  resolveCurrentPriceUsdMock,
} = vi.hoisted(() => ({
  findFirstMock: vi.fn(),
  findManyExecutionMock: vi.fn(),
  findManyPortfolioTradeMock: vi.fn(),
  getOpenSpotHoldingMock: vi.fn(),
  getOpenSpotHoldingsMock: vi.fn(),
  resolveCurrentPriceUsdMock: vi.fn(),
}))

vi.mock("@/lib/prisma", () => ({
  prisma: {
    exit_strategy: {
      findFirst: findFirstMock,
    },
    exit_strategy_execution: {
      findMany: findManyExecutionMock,
    },
    portfolio_trade: {
      findMany: findManyPortfolioTradeMock,
    },
  },
}))

vi.mock("@/lib/current-price", () => ({
  resolveCurrentPriceUsd: resolveCurrentPriceUsdMock,
}))

vi.mock("@/services/portfolio-holdings.service", () => ({
  getOpenSpotHolding: getOpenSpotHoldingMock,
  getOpenSpotHoldings: getOpenSpotHoldingsMock,
}))

import {
  buildExitStrategySummary,
  parseExcludedCoinSymbols,
  serializeExcludedCoinSymbols,
} from "@/services/exit-strategy.service"

describe("exit strategy symbol helpers", () => {
  it("parses, normalizes, de-duplicates and sorts excluded symbols", () => {
    expect(
      parseExcludedCoinSymbols('["eth", " BTC ", "eth", 123, "ada"]'),
    ).toEqual(["ADA", "BTC", "ETH"])
  })

  it("returns an empty list for invalid json", () => {
    expect(parseExcludedCoinSymbols("not-json")).toEqual([])
  })

  it("serializes normalized symbols or null when empty", () => {
    expect(serializeExcludedCoinSymbols(["eth", " btc ", "ETH"])).toBe(
      '["BTC","ETH"]',
    )
    expect(serializeExcludedCoinSymbols([])).toBeNull()
  })
})

describe("buildExitStrategySummary", () => {
  it("returns realized gain from portfolio sell transactions", async () => {
    findFirstMock.mockResolvedValue({
      id: "strategy-1",
      coin_symbol: "HYPE",
      is_all_coins: false,
      excluded_coin_symbols_json: null,
      strategy_type: "percentage",
      sell_percent: 25,
      gain_percent: 30,
      starting_quantity: null,
      is_active: true,
    })
    findManyExecutionMock.mockResolvedValueOnce([])
    findManyPortfolioTradeMock.mockResolvedValueOnce([
      { qty: 10, price_usd: 800, fee_usd: 5 },
      { qty: 0.5, price_usd: 660, fee_usd: 0.73 },
    ])
    getOpenSpotHoldingMock.mockResolvedValue({
      symbol: "HYPE",
      qty: 10,
      investedUsd: 200,
      avgEntryPriceUsd: 20,
    })
    resolveCurrentPriceUsdMock.mockResolvedValue({
      price: 22,
      source: "coingecko",
      isEstimated: false,
    })

    const summary = await buildExitStrategySummary("account-1", "strategy-1")

    expect(summary.assets[0]).toEqual(
      expect.objectContaining({
        coinSymbol: "HYPE",
        status: "pending",
        qtyToSell: 2.5,
        targetPriceUsd: 26,
        usdValueToSell: 65,
      }),
    )
    expect(summary.totalProfitUsd).toBe(0)
    expect(summary.realizedGainUsd).toBe(8324.27)
  })
})
