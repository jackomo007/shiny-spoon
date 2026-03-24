import { TradeAnalyzerSchema } from "@/lib/validators/trade-analyzer"
import { describe, expect, it } from "vitest"

describe("TradeAnalyzerSchema", () => {
  it("coerces numeric strings into numbers", () => {
    const parsed = TradeAnalyzerSchema.parse({
      strategy_id: "strat_1",
      asset: "BTC",
      amount_spent: "1000",
      entry_price: "50000",
      take_profit_price: "55000",
      stop_price: "48000",
    })

    expect(parsed.amount_spent).toBe(1000)
    expect(parsed.entry_price).toBe(50000)
  })

  it("rejects invalid assets", () => {
    const result = TradeAnalyzerSchema.safeParse({
      asset: "B",
      amount_spent: 1000,
      entry_price: 1,
      take_profit_price: 2,
      stop_price: 0.5,
    })

    expect(result.success).toBe(false)
    expect(result.error?.issues[0]?.message).toBe("Invalid asset")
  })
})
