import { calcJournalPnl, calcPnl, qtyFrom } from "@/lib/trade-helpers"
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

  it("does not count target pnl for an in-progress trade", () => {
    expect(
      calcJournalPnl({
        side: "long",
        status: "in_progress",
        entry: 76_000,
        exit: 80_000,
        stopLoss: 70_208,
        amountSpent: 1853.4912,
        tradeType: 2,
        tradingFee: 0,
      }),
    ).toBeNull()
  })

  it("uses stop loss for a losing long trade even when take profit is set", () => {
    expect(
      calcJournalPnl({
        side: "long",
        status: "loss",
        entry: 76_000,
        exit: 80_000,
        stopLoss: 70_208,
        amountSpent: 1853.4912,
        tradeType: 2,
        tradingFee: 0,
      }),
    ).toBe(-141.26)
  })

  it("uses exit price for a winning long trade", () => {
    expect(
      calcJournalPnl({
        side: "long",
        status: "win",
        entry: 76_000,
        exit: 80_000,
        stopLoss: 70_208,
        amountSpent: 1853.4912,
        tradeType: 2,
        tradingFee: 0,
      }),
    ).toBe(97.55)
  })
})
