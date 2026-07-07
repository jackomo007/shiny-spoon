import { describe, expect, it } from "vitest";
import { calculatePortfolioPnl } from "@/lib/portfolio-pnl";

describe("calculatePortfolioPnl", () => {
  it("calculates realized profit against average cost basis", () => {
    const result = calculatePortfolioPnl([
      { kind: "buy", qty: 10, priceUsd: 100, feeUsd: 0 },
      { kind: "sell", qty: 4, priceUsd: 150, feeUsd: 5 },
    ]);

    expect(result.totalInvestedUsd).toBe(600);
    expect(result.realizedPnlUsd).toBe(195);
    expect(result.qtyHeld).toBe(6);
    expect(result.costBasisUsd).toBe(600);
    expect(result.transactions[1]).toEqual(
      expect.objectContaining({
        totalUsd: 595,
        realizedPnlUsd: 195,
        realizedPnlPct: 48.75,
      }),
    );
  });

  it("calculates realized loss when sell proceeds are below cost basis", () => {
    const result = calculatePortfolioPnl([
      { kind: "buy", qty: 10, priceUsd: 100, feeUsd: 0 },
      { kind: "sell", qty: 4, priceUsd: 80, feeUsd: 0 },
    ]);

    expect(result.realizedPnlUsd).toBe(-80);
    expect(result.transactions[1]).toEqual(
      expect.objectContaining({
        totalUsd: 320,
        realizedPnlUsd: -80,
        realizedPnlPct: -20,
      }),
    );
  });

  it("calculates total invested as open cost basis after sells", () => {
    const result = calculatePortfolioPnl([
      { kind: "buy", qty: 1, priceUsd: 21_841.28, feeUsd: 0 },
      { kind: "sell", qty: 0.1, priceUsd: 60_714, feeUsd: 0 },
    ]);

    expect(result.totalInvestedUsd).toBeCloseTo(19_657.15, 2);
  });

  it("keeps trading fees in buy cost basis and sell proceeds", () => {
    const result = calculatePortfolioPnl([
      { kind: "buy", qty: 10, priceUsd: 100, feeUsd: 10 },
      { kind: "sell", qty: 4, priceUsd: 150, feeUsd: 5 },
    ]);

    expect(result.costBasisUsd).toBe(606);
    expect(result.totalInvestedUsd).toBe(606);
    expect(result.realizedPnlUsd).toBe(191);
    expect(result.transactions[0]).toEqual(
      expect.objectContaining({
        totalUsd: 1010,
        feeUsd: 10,
      }),
    );
    expect(result.transactions[1]).toEqual(
      expect.objectContaining({
        totalUsd: 595,
        feeUsd: 5,
        realizedPnlUsd: 191,
      }),
    );
  });
});
