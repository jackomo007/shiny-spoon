import { describe, expect, it } from "vitest";
import { classifyPortfolioAsset } from "@/lib/portfolio-classification";

describe("classifyPortfolioAsset", () => {
  it("does not classify known large-cap alts as small when market cap is missing", () => {
    expect(classifyPortfolioAsset({ symbol: "ADA", marketCapUsd: null })).toBe(
      "large",
    );
  });

  it("uses market cap when it is available", () => {
    expect(
      classifyPortfolioAsset({ symbol: "NEW", marketCapUsd: 250_000_000 }),
    ).toBe("small");
    expect(
      classifyPortfolioAsset({ symbol: "NEW", marketCapUsd: 2_000_000_000 }),
    ).toBe("mid");
    expect(
      classifyPortfolioAsset({ symbol: "NEW", marketCapUsd: 20_000_000_000 }),
    ).toBe("large");
  });
});
