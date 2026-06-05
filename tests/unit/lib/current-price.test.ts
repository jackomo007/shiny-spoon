import { beforeEach, describe, expect, it, vi } from "vitest"

const findUniqueMock = vi.fn()
const findFirstMock = vi.fn()
const cgPriceUsdByIdSafeMock = vi.fn()

vi.mock("@/lib/prisma", () => ({
  prisma: {
    verified_asset: {
      findUnique: findUniqueMock,
    },
    coin_price_structure: {
      findFirst: findFirstMock,
    },
  },
}))

vi.mock("@/lib/markets/coingecko", () => ({
  cgPriceUsdByIdSafe: cgPriceUsdByIdSafeMock,
}))

describe("resolveCurrentPriceUsd", () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    findFirstMock.mockResolvedValue(null)
    global.fetch = vi.fn().mockResolvedValue({ ok: false, status: 404 })
  })

  it("uses the persisted CoinGecko id when Binance has no pair for the symbol", async () => {
    findUniqueMock.mockResolvedValue({ coingecko_id: "hyperliquid" })
    cgPriceUsdByIdSafeMock.mockResolvedValue({
      ok: true,
      id: "hyperliquid",
      priceUsd: 41.25,
      change24hPct: 2.1,
    })

    const { resolveCurrentPriceUsd } = await import("@/lib/current-price")

    await expect(resolveCurrentPriceUsd("account-1", "HYPE", 22)).resolves.toEqual({
      price: 41.25,
      source: "coingecko",
      isEstimated: false,
    })

    expect(cgPriceUsdByIdSafeMock).toHaveBeenCalledWith("hyperliquid")
    expect(findFirstMock).not.toHaveBeenCalled()
  })
})
