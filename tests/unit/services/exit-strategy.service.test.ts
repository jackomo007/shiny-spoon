import { describe, expect, it, vi } from "vitest"

vi.mock("@/lib/prisma", () => ({
  prisma: {},
}))

vi.mock("@/lib/current-price", () => ({
  resolveCurrentPriceUsd: vi.fn(),
}))

vi.mock("@/services/portfolio-holdings.service", () => ({
  getOpenSpotHolding: vi.fn(),
  getOpenSpotHoldings: vi.fn(),
}))

import {
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
