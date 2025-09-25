import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { TradeAnalyzerSchema } from "@/lib/validators/trade-analyzer"
import { fetchKlines } from "@/lib/klines"
import { generateCandlePng } from "@/lib/chart-image"
import { uploadPng } from "@/lib/s3"
import { analyzeTradeWithChart } from "@/lib/ai-analyzer"
import { buildTradeAnalyzerPrompt } from "@/lib/prompts/trade-analyzer"
import {
  journal_entry_side as JournalEntrySide,
  timeframe as TimeframeEnum,
} from "@prisma/client"

function tfToBinance(tf: "h1" | "h4" | "d1") {
  return tf === "h1" ? "1h" : tf === "h4" ? "4h" : "1d"
}

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id || !session.accountId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await req.json().catch(() => ({}))
    const parsed = TradeAnalyzerSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
    }

    const data = parsed.data
    const accountId = session.accountId

    let strategy:
      | { id: string; name: string | null; rules: Array<{ title: string; description: string | null }> }
      | null = null

    if (data.strategy_id) {
      const st = await prisma.strategy.findFirst({
        where: { id: data.strategy_id, account_id: accountId },
        include: { strategy_rules: { include: { rule: true } } },
      })
      if (st) {
        strategy = {
          id: st.id,
          name: st.name,
          rules: st.strategy_rules.map((sr) => ({
            title: sr.rule.title,
            description: sr.rule.description,
          })),
        }
      }
    }

    const binanceInterval = tfToBinance(data.timeframe)
    const candles = await fetchKlines(data.asset.toUpperCase(), binanceInterval, 150)

    const png = await generateCandlePng(candles, {
      width: 1280,
      height: 720,
      symbol: data.asset.toUpperCase(),
      timeframeLabel: data.timeframe,
      title: `${data.asset.toUpperCase()} · ${data.timeframe.toUpperCase()} (Pre-Trade)`,
      sidePanelWidth: 280,
    })

    const imageUrl = await uploadPng(png, "trade-analyzer")

    const prompt = buildTradeAnalyzerPrompt({
      strategyName: strategy?.name ?? null,
      strategyRules: strategy?.rules ?? [],
      asset: data.asset.toUpperCase(),
      tradeType: data.trade_type,
      side: data.side,
      amountSpent: data.amount_spent,
      entry: data.entry_price,
      target: data.target_price ?? null,
      stop: data.stop_price ?? null,
      timeframe: data.timeframe,
    })

    const { text, model, prompt: usedPrompt } = await analyzeTradeWithChart({ imageUrl, prompt })

    const MAX_TEXT = 65_000;
    const MAX_URL  = 2048;

    const safeText = (s: string) => (s.length > MAX_TEXT ? s.slice(0, MAX_TEXT) : s);
    const safeUrl  = (s: string) => (s.length > MAX_URL  ? s.slice(0, MAX_URL)  : s);

    const saved = await prisma.trade_pre_analysis.create({
    data: {
        account_id: accountId,
        strategy_id: strategy?.id ?? null,
        asset_symbol: data.asset.toUpperCase(),
        trade_type: data.trade_type === "spot" ? 1 : 2,
        side: JournalEntrySide[data.side],
        timeframe: TimeframeEnum[data.timeframe],

        amount_spent: data.amount_spent,
        entry_price: data.entry_price,
        target_price: data.target_price ?? null,
        stop_price: data.stop_price ?? null,

        chart_image: safeUrl(imageUrl),
        analysis_text: safeText(text),
        model_used: model,
        prompt_used: safeText(usedPrompt),
    },
    select: { id: true, analysis_text: true, chart_image: true, created_at: true },
    })

    return NextResponse.json({
      id: saved.id,
      imageUrl,
      analysis: text,
      createdAt: saved.created_at,
    })
  } catch (err: unknown) {
    console.error("[trade-analyzer] POST failed:", err)
    const message = err instanceof Error ? err.message : "Internal error"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
