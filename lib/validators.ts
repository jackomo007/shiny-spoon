import { z } from "zod"

export const StrategyUpsert = z.object({
  name: z.string().min(2, "Name is required"),
  rules: z.array(
    z.object({
      title: z.string().trim().min(1, "Confluence title is required"),
      description: z.string().optional().nullable(),
    })
  ).default([]),
  description: z.string().trim().min(1, "Description is required").max(10000, "Description is too long"),
})
export type StrategyUpsertType = z.infer<typeof StrategyUpsert>
