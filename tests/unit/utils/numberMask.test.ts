import {
  isValidNeutral,
  limitDecimals,
  normalizeDecimalFlexible,
  sanitizeInput,
  toDisplayUS,
  toRawNeutral,
} from "@/utils/numberMask"
import { describe, expect, it } from "vitest"

describe("numberMask helpers", () => {
  it("sanitizes non numeric characters", () => {
    expect(sanitizeInput("R$ 12a3,45%")).toBe("123,45")
  })

  it("normalizes multiple decimal separators", () => {
    expect(normalizeDecimalFlexible("1,234.5.6")).toBe("1234.56")
  })

  it("limits decimal precision", () => {
    expect(limitDecimals("123.456789", 4)).toBe("123.4567")
  })

  it("formats values for display with grouping", () => {
    expect(toDisplayUS("0012345.6789", 2)).toBe("12,345.67")
  })

  it("preserves a trailing decimal separator in raw neutral output", () => {
    expect(toRawNeutral("0012.", 8)).toBe("12.")
  })

  it("validates partial and complete neutral values", () => {
    expect(isValidNeutral("")).toBe(true)
    expect(isValidNeutral("123.45")).toBe(true)
    expect(isValidNeutral(".5")).toBe(false)
  })
})
