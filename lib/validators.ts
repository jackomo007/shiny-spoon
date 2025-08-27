import { z } from "zod"

export const StrategyUpsert = z.object({
  name: z.string().min(2, "Name is required"),
  rules: z.array(z.string().min(1)).default([])
})
