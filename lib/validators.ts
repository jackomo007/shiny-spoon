import { z } from "zod"

export const StrategyUpsert = z.object({
  name: z.string().min(2, "Name is required"),
  rules: z.array(
    z.object({
      title: z.string().min(1, "Rule title is required"),
      description: z.string().optional().nullable(),
    })
  ).default([]),
})
