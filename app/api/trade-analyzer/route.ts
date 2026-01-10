export const runtime = "nodejs";
export const revalidate = 0;
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { TradeAnalyzerSchema } from "@/lib/validators/trade-analyzer";
import { buildTradeAnalyzerPrompt } from "@/lib/prompts/trade-analyzer";
import { analyzeTradeText } from "@/lib/ai-analyzer";
import { recordAiUsage } from "@/lib/ai-usage";
import { journal_entry_side as JournalEntrySide } from "@prisma/client";

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id || !session.accountId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const parsed = TradeAnalyzerSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }
    const data = parsed.data;

    const accountIdNum = Number(session.accountId);
    const assetSymbol = data.asset.toUpperCase();

    let strategy:
      | {
          id: string;
          name: string | null;
          rules: Array<{ title: string; description: string | null }>;
        }
      | null = null;

    if (data.strategy_id) {
      const st = await prisma.strategy.findFirst({
        where: { id: data.strategy_id, account_id: session.accountId },
        include: { strategy_rules: { include: { rule: true } } },
      });
      if (st) {
        strategy = {
          id: st.id,
          name: st.name,
          rules: st.strategy_rules.map((sr) => ({
            title: sr.rule.title,
            description: sr.rule.description,
          })),
        };
      }
    }

    const prompt = await buildTradeAnalyzerPrompt({
      strategyName: strategy?.name ?? null,
      strategyRules: strategy?.rules ?? [],
      asset: assetSymbol,
      amountSpent: data.amount_spent,
      entry: data.entry_price,
      target: data.take_profit_price,
      stop: data.stop_price,
    });

    const { text, model, prompt: usedPrompt, usage } = await analyzeTradeText({ prompt });

    const legacyDefaults = {
      trade_type: 1,
      side: JournalEntrySide.long,
      chart_image: "",
      timeframe_code: "1H",
    };

    const saved = await prisma.trade_pre_analysis.create({
      data: {
        account_id: session.accountId,
        strategy_id: strategy?.id ?? null,
        asset_symbol: assetSymbol,
        amount_spent: data.amount_spent,
        entry_price: data.entry_price,
        target_price: data.take_profit_price,
        stop_price: data.stop_price,
        analysis_text: text,
        model_used: model,
        prompt_used: usedPrompt,
        ...legacyDefaults,
      },
      select: { id: true, analysis_text: true, created_at: true },
    });

    await recordAiUsage({
      kind: "trade",
      model,
      inputTokens: usage.input,
      outputTokens: usage.output,
      accountId: Number.isFinite(accountIdNum) ? accountIdNum : null,
      preAnalysisId: saved.id,
      meta: { asset: assetSymbol },
    });

    return NextResponse.json({
      id: saved.id,
      analysis: text,
      createdAt: saved.created_at,
    });
  } catch (err) {
    console.error("[trade-analyzer] POST failed:", err);
    const message = err instanceof Error ? err.message : "Internal error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
