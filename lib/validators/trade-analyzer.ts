import { z } from "zod"

export const TradeAnalyzerSchema = z.object({
  strategy_id: z.string().min(1).optional().nullable(),
  asset: z.string().min(1),
  trade_type: z.enum(["spot","futures"]),
  side: z.enum(["buy","sell","long","short"]),
  amount_spent: z.number().positive(),
  entry_price: z.number().positive(),
  target_price: z.number().positive().optional().nullable(),
  stop_price: z.number().positive().optional().nullable(),
  timeframe: z.enum(["h1","h4","d1"]),
}).superRefine((v, ctx) => {
  const isSpot = v.trade_type === "spot"
  const spotSideOk = isSpot ? (v.side === "buy" || v.side === "sell") : true
  const futSideOk  = !isSpot ? (v.side === "long" || v.side === "short") : true
  if (!spotSideOk || !futSideOk) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["side"], message: isSpot ? "Spot: side deve ser buy/sell" : "Futures: side deve ser long/short" })
  }
})
export type TradeAnalyzerInput = z.infer<typeof TradeAnalyzerSchema>
