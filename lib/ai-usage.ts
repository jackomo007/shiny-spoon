import "server-only";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";

type Price = { inputPerTok: number; outputPerTok: number };

const PRICES: Record<string, Price> = {
  "gpt-4o-mini": { inputPerTok: 0.5 / 1_000_000, outputPerTok: 1.5 / 1_000_000 },
  "gpt-4o":      { inputPerTok: 5   / 1_000_000, outputPerTok: 15  / 1_000_000 },
};

function getPrice(model: string): Price {
  return PRICES[model] ?? PRICES["gpt-4o-mini"];
}

export async function recordAiUsage(opts: {
  kind: "chart" | "trade" | "structure";
  model: string;
  inputTokens: number;
  outputTokens: number;
  accountId?: number | null;
  trackerId?: string | null;
  preAnalysisId?: string | null;
  meta?: unknown;
}) {
  const p = getPrice(opts.model);
  const cost = opts.inputTokens * p.inputPerTok + opts.outputTokens * p.outputPerTok;
  const metaStr =
    opts.meta == null
      ? null
      : typeof opts.meta === "string"
      ? opts.meta
      : JSON.stringify(opts.meta);

  try {
    const row = await prisma.ai_usage.create({
      data: {
        kind: opts.kind,
        model_used: opts.model,
        input_tokens: opts.inputTokens,
        output_tokens: opts.outputTokens,
        cost_usd: cost,
        account_id: opts.accountId ?? null,
        tracker_id: opts.trackerId ?? null,
        pre_analysis_id: opts.preAnalysisId ?? null,
        meta: metaStr,
      },
    });
    console.log("[ai_usage] created", {
      id: row.id,
      kind: row.kind,
      cost: String(row.cost_usd),
      input: row.input_tokens,
      output: row.output_tokens,
    });
  } catch (e) {
    console.error("[ai_usage] create failed:", e);
  }

  return cost;
}

