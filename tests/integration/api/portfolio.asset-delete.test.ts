import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  getServerSessionMock,
  migrateLegacyPortfolioTradesMock,
  findManyMock,
  findUniqueMock,
  deleteManyTradesMock,
  deleteManySettingsMock,
  setPortfolioAssetHiddenMock,
  deleteAssetExitStrategiesIfNoHoldingMock,
  cgPriceUsdByIdSafeMock,
} = vi.hoisted(() => ({
  getServerSessionMock: vi.fn(),
  migrateLegacyPortfolioTradesMock: vi.fn(),
  findManyMock: vi.fn(),
  findUniqueMock: vi.fn(),
  deleteManyTradesMock: vi.fn(),
  deleteManySettingsMock: vi.fn(),
  setPortfolioAssetHiddenMock: vi.fn(),
  deleteAssetExitStrategiesIfNoHoldingMock: vi.fn(),
  cgPriceUsdByIdSafeMock: vi.fn(),
}));

vi.mock("next-auth", () => ({
  getServerSession: getServerSessionMock,
}));

vi.mock("@/lib/auth", () => ({
  authOptions: {},
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    portfolio_trade: {
      findMany: findManyMock,
      deleteMany: deleteManyTradesMock,
    },
    portfolio_asset_setting: {
      deleteMany: deleteManySettingsMock,
    },
    verified_asset: {
      findUnique: findUniqueMock,
    },
  },
}));

vi.mock("@/services/portfolio-legacy-migration.service", () => ({
  migrateLegacyPortfolioTrades: migrateLegacyPortfolioTradesMock,
}));

vi.mock("@/services/exit-strategy.service", () => ({
  deleteAssetExitStrategiesIfNoHolding:
    deleteAssetExitStrategiesIfNoHoldingMock,
}));

vi.mock("@/services/portfolio-asset-settings.service", () => ({
  setPortfolioAssetHidden: setPortfolioAssetHiddenMock,
}));

vi.mock("@/lib/markets/coingecko", () => ({
  cgPriceUsdByIdSafe: cgPriceUsdByIdSafeMock,
}));

vi.mock("@/lib/markets/pivotPoints", () => ({
  calculateKeyLevels: vi.fn(),
}));

import { DELETE } from "@/app/api/portfolio/[symbol]/route";

describe("/api/portfolio/[symbol] DELETE", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getServerSessionMock.mockResolvedValue({ accountId: "acc_1" });
    migrateLegacyPortfolioTradesMock.mockResolvedValue(undefined);
    findUniqueMock.mockResolvedValue({ coingecko_id: "hyperliquid" });
    cgPriceUsdByIdSafeMock.mockResolvedValue({ ok: true, priceUsd: 82 });
    setPortfolioAssetHiddenMock.mockResolvedValue(undefined);
    deleteManyTradesMock.mockResolvedValue({ count: 3 });
    deleteManySettingsMock.mockResolvedValue({ count: 1 });
    deleteAssetExitStrategiesIfNoHoldingMock.mockResolvedValue(undefined);
  });

  it("keeps history by hiding the asset without creating transactions", async () => {
    findManyMock.mockResolvedValue([
      {
        id: "tx_1",
        asset_name: "HYPE",
        kind: "buy",
        qty: 2,
        price_usd: 50,
        trade_datetime: new Date("2026-08-01T00:00:00.000Z"),
        fee_usd: 0,
        chain_id: "hyperliquid",
      },
    ]);

    const response = await DELETE(
      new Request("http://localhost/api/portfolio/HYPE", {
        method: "DELETE",
        body: JSON.stringify({ mode: "keepHistory" }),
      }),
      { params: Promise.resolve({ symbol: "HYPE" }) },
    );

    expect(response.status).toBe(200);
    expect(setPortfolioAssetHiddenMock).toHaveBeenCalledWith({
      accountId: "acc_1",
      symbol: "HYPE",
      isHidden: true,
    });
    expect(deleteManyTradesMock).not.toHaveBeenCalled();
    expect(deleteAssetExitStrategiesIfNoHoldingMock).toHaveBeenCalledWith(
      "acc_1",
      "HYPE",
    );
  });

  it("deletes the asset transaction history when requested", async () => {
    const response = await DELETE(
      new Request("http://localhost/api/portfolio/HYPE", {
        method: "DELETE",
        body: JSON.stringify({ mode: "deleteHistory" }),
      }),
      { params: Promise.resolve({ symbol: "HYPE" }) },
    );

    expect(response.status).toBe(200);
    expect(deleteManyTradesMock).toHaveBeenCalledWith({
      where: {
        account_id: "acc_1",
        asset_name: "HYPE",
        kind: { in: ["buy", "sell", "init"] },
      },
    });
    expect(deleteManySettingsMock).toHaveBeenCalledWith({
      where: { account_id: "acc_1", asset_symbol: "HYPE" },
    });
    expect(setPortfolioAssetHiddenMock).not.toHaveBeenCalled();
  });
});
