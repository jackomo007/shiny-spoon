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
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response(JSON.stringify({ items: [] }))),
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
});
