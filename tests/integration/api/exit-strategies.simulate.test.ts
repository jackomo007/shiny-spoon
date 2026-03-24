import { beforeEach, describe, expect, it, vi } from "vitest"

const {
  getServerSessionMock,
  getOpenSpotHoldingMock,
  getOpenSpotHoldingsMock,
} = vi.hoisted(() => ({
  getServerSessionMock: vi.fn(),
  getOpenSpotHoldingMock: vi.fn(),
  getOpenSpotHoldingsMock: vi.fn(),
}))

vi.mock("next-auth", () => ({
  getServerSession: getServerSessionMock,
}))

vi.mock("@/lib/auth", () => ({
  authOptions: {},
}))

vi.mock("@/services/portfolio-holdings.service", () => ({
  getOpenSpotHolding: getOpenSpotHoldingMock,
  getOpenSpotHoldings: getOpenSpotHoldingsMock,
}))

import { POST } from "@/app/api/exit-strategies/simulate/route"

describe("POST /api/exit-strategies/simulate", () => {
  beforeEach(() => {
    getServerSessionMock.mockReset()
    getOpenSpotHoldingMock.mockReset()
    getOpenSpotHoldingsMock.mockReset()
  })

  it("returns 401 when there is no active account in session", async () => {
    getServerSessionMock.mockResolvedValue(null)

    const response = await POST(
      new Request("http://localhost/api/exit-strategies/simulate", {
        method: "POST",
        body: JSON.stringify({
          allCoins: true,
          sellPercent: 25,
          gainPercent: 10,
        }),
      }),
    )

    expect(response.status).toBe(401)
    expect(await response.json()).toEqual({ error: "Unauthorized" })
  })

  it("returns 400 for invalid payloads", async () => {
    getServerSessionMock.mockResolvedValue({ accountId: "acc_1" })

    const response = await POST(
      new Request("http://localhost/api/exit-strategies/simulate", {
        method: "POST",
        body: JSON.stringify({
          allCoins: false,
          coinSymbols: [],
          sellPercent: 25,
          gainPercent: 10,
        }),
      }),
    )

    expect(response.status).toBe(400)
    expect(await response.json()).toEqual({
      error: expect.objectContaining({
        fieldErrors: expect.any(Object),
      }),
    })
  })

  it("simulates selected coins even when a holding does not exist yet", async () => {
    getServerSessionMock.mockResolvedValue({ accountId: "acc_1" })
    getOpenSpotHoldingMock.mockResolvedValue(undefined)

    const response = await POST(
      new Request("http://localhost/api/exit-strategies/simulate", {
        method: "POST",
        body: JSON.stringify({
          allCoins: false,
          coinSymbols: [" btc "],
          sellPercent: 50,
          gainPercent: 10,
          maxSteps: 2,
        }),
      }),
    )

    const payload = await response.json()

    expect(response.status).toBe(200)
    expect(payload.data.results).toEqual([
      {
        coinSymbol: "BTC",
        qtyOpen: 0,
        entryPriceUsd: 0,
        rows: [
          {
            gainPercent: 10,
            targetPriceUsd: 0,
            plannedQtyToSell: 0,
            executedQtyToSell: null,
            proceedsUsd: 0,
            remainingQtyAfter: 0,
            realizedProfitUsd: 0,
            cumulativeRealizedProfitUsd: 0,
            isExecuted: false,
          },
        ],
      },
    ])
  })

  it("simulates all current holdings", async () => {
    getServerSessionMock.mockResolvedValue({ accountId: "acc_1" })
    getOpenSpotHoldingsMock.mockResolvedValue([
      {
        symbol: "ETH",
        qty: 2,
        investedUsd: 2_000,
        avgEntryPriceUsd: 1_000,
      },
    ])

    const response = await POST(
      new Request("http://localhost/api/exit-strategies/simulate", {
        method: "POST",
        body: JSON.stringify({
          allCoins: true,
          sellPercent: 50,
          gainPercent: 10,
          maxSteps: 2,
        }),
      }),
    )

    const payload = await response.json()
    const [result] = payload.data.results

    expect(response.status).toBe(200)
    expect(result.coinSymbol).toBe("ETH")
    expect(result.rows[0]).toEqual(
      expect.objectContaining({
        gainPercent: 10,
        targetPriceUsd: 1100,
        plannedQtyToSell: 1,
        proceedsUsd: 1100,
        remainingQtyAfter: 1,
        realizedProfitUsd: 100,
        cumulativeRealizedProfitUsd: 100,
      }),
    )
    expect(result.rows[1]).toEqual(
      expect.objectContaining({
        gainPercent: 20,
        targetPriceUsd: 1200,
        plannedQtyToSell: 0.5,
        remainingQtyAfter: 0.5,
        cumulativeRealizedProfitUsd: 200,
      }),
    )
  })
})
