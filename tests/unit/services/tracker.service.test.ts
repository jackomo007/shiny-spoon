import { beforeEach, describe, expect, it, vi } from "vitest"

const { findManyMock } = vi.hoisted(() => ({
  findManyMock: vi.fn(),
}))

vi.mock("@/lib/prisma", () => ({
  prisma: {
    chart_tracker: {
      findMany: findManyMock,
    },
  },
}))

vi.mock("@/lib/s3", () => ({
  uploadPng: vi.fn(),
}))

vi.mock("@/lib/ai-analyzer", () => ({
  analyzeChartImage: vi.fn(),
}))

vi.mock("@/lib/klines", () => ({
  fetchKlines: vi.fn(),
}))

vi.mock("@/lib/chart-image", () => ({
  generateCandlePng: vi.fn(),
}))

vi.mock("@/lib/ai-usage", () => ({
  recordAiUsage: vi.fn(),
}))

import { findDueTrackers, tfToMs } from "@/services/tracker.service"

describe("tracker service timing", () => {
  beforeEach(() => {
    findManyMock.mockReset()
  })

  it("converts timeframes to milliseconds", () => {
    expect(tfToMs("h1")).toBe(3_600_000)
    expect(tfToMs("h4")).toBe(14_400_000)
    expect(tfToMs("d1")).toBe(86_400_000)
  })

  it("returns only trackers that are due to run", async () => {
    const now = new Date("2026-03-24T12:00:00.000Z")

    findManyMock.mockResolvedValue([
      { id: "h1-due", tf: "h1", last_run_at: new Date("2026-03-24T10:30:00.000Z") },
      { id: "h4-wait", tf: "h4", last_run_at: new Date("2026-03-24T09:30:00.000Z") },
      { id: "d1-new", tf: "d1", last_run_at: null },
    ])

    const due = await findDueTrackers(now)

    expect(findManyMock).toHaveBeenCalledWith({ where: { active: true } })
    expect(due.map((tracker: { id: string }) => tracker.id)).toEqual([
      "h1-due",
      "d1-new",
    ])
  })
})
