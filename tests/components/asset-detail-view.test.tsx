import AssetDetailView from "@/components/portfolio/AssetDetailView";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const assetResponse = {
  symbol: "HYPE",
  name: "Hyperliquid",
  iconUrl: null,
  balance: {
    quantity: 75.64644068,
    valueUsd: 4481,
  },
  metrics: {
    currentPrice: 59,
    change24h: {
      usd: 0,
      pct: 0,
    },
    totalProfit: {
      usd: 0,
      pct: 0,
    },
    realizedProfit: 0,
    unrealizedProfit: 0,
    avgBuyPrice: 59,
    totalInvested: 4498.86,
  },
  keyLevels: {
    supports: [],
    resistances: [],
  },
  transactions: [
    {
      id: "tx_1",
      side: "buy",
      executedAt: "2026-06-25T19:01:25.000Z",
      qty: 75.64644068,
      priceUsd: 59,
      totalUsd: 4481,
      feeUsd: 17.86,
      gainLossUsd: null,
      gainLossPct: null,
    },
  ],
};

describe("AssetDetailView", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn((input: RequestInfo | URL) => {
        const url = String(input);

        if (url.includes("/api/portfolio/HYPE")) {
          return Promise.resolve(new Response(JSON.stringify(assetResponse)));
        }

        if (url.includes("/api/exit-strategies")) {
          return Promise.resolve(new Response(JSON.stringify({ data: [] })));
        }

        return Promise.resolve(new Response(JSON.stringify({ items: [] })));
      }),
    );
  });

  it("shows transaction fee below the total in the asset transaction table", async () => {
    render(<AssetDetailView symbol="HYPE" onBack={vi.fn()} />);

    expect(await screen.findByText("Hyperliquid Transactions")).toBeInTheDocument();
    expect(screen.getAllByText("$4,481.00")).toHaveLength(2);
    expect(screen.getByText("-$17.86 fee")).toBeInTheDocument();
  });

  it("opens the remove asset confirmation with keep history selected by default", async () => {
    const user = userEvent.setup();

    render(<AssetDetailView symbol="HYPE" onBack={vi.fn()} />);

    await screen.findByText("Hyperliquid Transactions");
    await user.click(screen.getByLabelText("Asset actions"));
    await user.click(screen.getByRole("button", { name: "Delete HYPE Position" }));

    expect(screen.getByText("This will remove HYPE from your portfolio.")).toBeInTheDocument();
    expect(screen.getByLabelText("Keep transaction history")).toBeChecked();
    expect(screen.getByLabelText("Delete asset and transaction history")).not.toBeChecked();
  });
});
