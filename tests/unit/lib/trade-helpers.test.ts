import { calcPnl, qtyFrom } from "@/lib/trade-helpers"
import { describe, expect, it } from "vitest"

describe("trade helpers", () => {
  it("calculates spot quantity from amount spent", () => {
    expect(
      qtyFrom({ amountSpent: 200, entryPrice: 50, tradeType: 1 }),
    ).toBe(4)
  })

  it("calculates futures quantity using leverage", () => {
    expect(
      qtyFrom({ amountSpent: 100, entryPrice: 25, tradeType: 2, leverage: 5 }),
    ).toBe(20)
  })

  it("returns null pnl while the trade is open", () => {
    expect(
      calcPnl({
        side: "buy",
        entry: 100,
        exit: null,
        amountSpent: 1_000,
        tradeType: 1,
      }),
    ).toBeNull()
  })

  it("calculates long pnl with buy and sell fees", () => {
    expect(
      calcPnl({
        side: "long",
        entry: 100,
        exit: 120,
        amountSpent: 1_000,
        tradeType: 2,
        leverage: 3,
        buyFee: 5,
        sellFee: 7,
      }),
    ).toBe(588)
  })

  it("calculates short pnl using tradingFee when provided", () => {
    expect(
      calcPnl({
        side: "short",
        entry: 100,
        exit: 90,
        amountSpent: 500,
        tradeType: 2,
        leverage: 2,
        tradingFee: 4.25,
      }),
    ).toBe(95.75)
  })
})
