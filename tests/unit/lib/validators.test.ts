import { StrategyUpsert } from "@/lib/validators"
import { describe, expect, it } from "vitest"

describe("StrategyUpsert schema", () => {
  it("accepts a valid strategy payload", () => {
    const parsed = StrategyUpsert.parse({
      name: "Breakout setup",
      description: "Only enter after volume confirmation.",
      rules: [{ title: "Trend", description: "Aligned with higher timeframe" }],
    })

    expect(parsed.name).toBe("Breakout setup")
    expect(parsed.rules).toHaveLength(1)
  })

  it("rejects strategies without a description", () => {
    const result = StrategyUpsert.safeParse({
      name: "Scalp",
      description: "",
      rules: [],
    })

    expect(result.success).toBe(false)
    expect(result.error?.issues[0]?.message).toBe("Description is required")
  })
})
