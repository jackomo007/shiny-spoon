import { z } from "zod";

export const TradeAnalyzerSchema = z.object({
  strategy_id: z.string().min(1).optional().nullable(),
  asset: z.string().min(2, "Invalid asset"),
  amount_spent: z.coerce.number().positive("Amount spent must be greater than 0"),
  entry_price: z.coerce.number().positive("Entry price must be greater than 0"),
  take_profit_price: z.coerce.number().positive("Take profit price must be greater than 0"),
  stop_price: z.coerce.number().positive("Stop loss price must be greater than 0"),
});

export type TradeAnalyzerInput = z.infer<typeof TradeAnalyzerSchema>;
