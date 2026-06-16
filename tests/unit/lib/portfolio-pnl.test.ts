import { describe, expect, it } from "vitest";
import { calculatePortfolioPnl } from "@/lib/portfolio-pnl";

describe("calculatePortfolioPnl", () => {
  it("calculates realized profit against average cost basis", () => {
    const result = calculatePortfolioPnl([
      { kind: "buy", qty: 10, priceUsd: 100, feeUsd: 0 },
      { kind: "sell", qty: 4, priceUsd: 150, feeUsd: 5 },
    ]);

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
});
