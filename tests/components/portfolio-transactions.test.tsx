import AddTransactionModal from "@/components/portfolio/AddTransactionModal";
import TransactionsTable, {
  type TxRow,
} from "@/components/portfolio/TransactionsTable";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

function tx(overrides: Partial<TxRow> = {}): TxRow {
  return {
    id: "tx_1",
    side: "buy",
    symbol: "ADA",
    name: "Cardano",
    iconUrl: null,
    executedAt: "2026-06-30T12:00:00.000Z",
    qty: 10,
    priceUsd: 10,
    totalUsd: 100,
    feeUsd: 0,
    gainLossUsd: null,
    gainLossPct: null,
    ...overrides,
  };
}

describe("Portfolio transaction UI", () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.stubGlobal(
      "fetch",
      vi.fn((input: RequestInfo | URL) => {
        const url = String(input);

        if (url.includes("/api/portfolio/assets/chains")) {
          return Promise.resolve(
            new Response(
              JSON.stringify({
                defaultChainId: "bitcoin",
                items: [
                  { id: "bitcoin", name: "Bitcoin", symbol: "BTC" },
                  { id: "ethereum", name: "Ethereum", symbol: "ETH" },
                  { id: "solana", name: "Solana", symbol: "SOL" },
                ],
              }),
            ),
          );
        }

        if (url.includes("/api/portfolio/assets/top")) {
          return Promise.resolve(
            new Response(
              JSON.stringify({
                items: [
                  {
                    id: "ethereum",
                    symbol: "ETH",
                    name: "Ethereum",
                    image: null,
                    priceUsd: 3000,
                    change24hPct: null,
                    marketCapRank: 2,
                  },
                ],
              }),
            ),
          );
        }

        return Promise.resolve(new Response(JSON.stringify({ items: [] })));
      }),
    );
  });

  it("shows the trading fee below the total in the transaction table", () => {
    render(<TransactionsTable rows={[tx({ feeUsd: 2.5, totalUsd: 102.5 })]} />);

    expect(screen.getByText("$102.50")).toBeInTheDocument();
    expect(screen.getByText("-$2.50 fee")).toBeInTheDocument();
  });

  it("does not recalculate amount in edit mode when only the fee changes", async () => {
    const user = userEvent.setup();

    render(
      <AddTransactionModal
        open
        mode="edit"
        initialTx={tx()}
        onClose={vi.fn()}
        onDone={vi.fn()}
      />,
    );

    const amount = screen.getByLabelText("Amount");
    const total = screen.getByLabelText("Total (USD)");
    const fee = screen.getByLabelText(/Trading Fee/);

    expect(amount).toHaveValue("10");
    expect(total).toHaveValue("100");

    await user.clear(fee);
    await user.type(fee, "5");

    expect(amount).toHaveValue("10");
    expect(total).toHaveValue("100");
    expect(screen.queryByText("-$5.00 fee")).not.toBeInTheDocument();
  });

  it("keeps total as amount times price when a fee is entered before the amount", async () => {
    const user = userEvent.setup();

    render(
      <AddTransactionModal
        open
        mode="edit"
        initialTx={tx({ priceUsd: 70.28, qty: 0, totalUsd: 0, feeUsd: 0 })}
        onClose={vi.fn()}
        onDone={vi.fn()}
      />,
    );

    const amount = screen.getByLabelText("Amount");
    const total = screen.getByLabelText("Total (USD)");
    const fee = screen.getByLabelText(/Trading Fee/);

    await user.clear(fee);
    await user.type(fee, "1");
    await user.clear(amount);
    await user.type(amount, "1");

    expect(total).toHaveValue("70.28");
  });

  it("defaults the chain picker to bitcoin and hides other chains until search is focused", async () => {
    const user = userEvent.setup();

    render(
      <AddTransactionModal
        open
        mode="add"
        initialAsset={{
          id: "bitcoin",
          symbol: "BTC",
          name: "Bitcoin",
          priceUsd: 100000,
        }}
        onClose={vi.fn()}
        onDone={vi.fn()}
      />,
    );

    expect(await screen.findByText("Bitcoin")).toBeInTheDocument();
    expect(screen.queryByText("Ethereum")).not.toBeInTheDocument();

    await user.click(screen.getByLabelText("Chain"));

    expect(await screen.findByText("Ethereum")).toBeInTheDocument();
    expect(screen.getByText("Solana")).toBeInTheDocument();
  });

  it("persists the sell convert preference and receive asset", async () => {
    const user = userEvent.setup();

    render(
      <AddTransactionModal
        open
        mode="add"
        initialAsset={{
          id: "bitcoin",
          symbol: "BTC",
          name: "Bitcoin",
          priceUsd: 100000,
        }}
        onClose={vi.fn()}
        onDone={vi.fn()}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Sell" }));

    const checkbox = await screen.findByLabelText(
      "Convert proceeds to another asset",
    );
    await user.click(checkbox);
    await user.type(screen.getByLabelText("Amount"), "1");

    expect(window.localStorage.getItem("stakk.sellConvert.enabled")).toBe(
      "true",
    );
    expect(await screen.findByLabelText("Receive")).toBeInTheDocument();

    await user.selectOptions(screen.getByLabelText("Receive"), "ETH");

    expect(window.localStorage.getItem("stakk.sellConvert.asset")).toContain(
      '"symbol":"ETH"',
    );
    expect(screen.getByRole("button", { name: "Sell & Convert" })).toBeEnabled();
  });

  it("does not show sell conversion for stablecoin sells", () => {
    render(
      <AddTransactionModal
        open
        mode="edit"
        initialTx={tx({ side: "sell", symbol: "USDT", name: "Tether" })}
        onClose={vi.fn()}
        onDone={vi.fn()}
      />,
    );

    expect(
      screen.queryByLabelText("Convert proceeds to another asset"),
    ).not.toBeInTheDocument();
  });
});
