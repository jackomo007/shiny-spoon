import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { TradeAnalyzerSchema } from "@/lib/validators/trade-analyzer";
import { fetchKlines, type BinanceInterval } from "@/lib/klines";
import { generateCandlePng } from "@/lib/chart-image";
import { uploadPng } from "@/lib/s3";
import { analyzeTradeWithChart } from "@/lib/ai-analyzer";
import { buildTradeAnalyzerPrompt } from "@/lib/prompts/trade-analyzer";
import { journal_entry_side as JournalEntrySide } from "@prisma/client";
import { recordAiUsage } from "@/lib/ai-usage";

function parseTfToBinance(tfCode: string): BinanceInterval {
  const s = tfCode.trim().toLowerCase();
  const map: Record<string, BinanceInterval> = {
    "1m": "1m", "3m": "3m", "5m": "5m", "15m": "15m", "30m": "30m",
    "1h": "1h", "2h": "2h", "4h": "4h", "6h": "6h", "8h": "8h", "12h": "12h",
    "1d": "1d", "3d": "3d", "1w": "1w", "1mo": "1M", "1mth": "1M", "1month": "1M"
  };
  if (map[s]) return map[s];
  throw new Error(`Timeframe inválido: ${tfCode}`);
}

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
    const assetRow = await prisma.verified_asset.findFirst({ where: { symbol: assetSymbol } });
    if (!assetRow) {
      return NextResponse.json({ error: "Asset não verificado. Selecione um da lista." }, { status: 400 });
    }

    let strategy:
      | { id: string; name: string | null; rules: Array<{ title: string; description: string | null }> }
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

    const binanceInterval = parseTfToBinance(data.timeframe_code);
    const candles = await fetchKlines(assetSymbol, binanceInterval, 150);

    const png = await generateCandlePng(candles, {
      width: 1280,
      height: 720,
      symbol: assetSymbol,
      timeframeLabel: data.timeframe_code,
      title: `${assetSymbol} · ${data.timeframe_code.toUpperCase()} (Pre-Trade)`,
      sidePanelWidth: 0,
    });
    const imageUrl = await uploadPng(png, "trade-analyzer");

    const last = candles[candles.length - 1];
    const first = candles[0];
    const diff = last.close - first.open;
    const pct = (diff / first.open) * 100;
    const avgVol =
      candles.slice(-30).reduce((s, c) => s + c.volume, 0) /
      Math.max(1, Math.min(30, candles.length));

    const snapshot = {
      symbol: assetSymbol,
      exchange: "Binance",
      timeframe: binanceInterval,
      priceClose: last.close,
      priceDiff: diff,
      pricePct: pct,
      high: last.high,
      low: last.low,
      volumeLast: last.volume,
      avgVol30: avgVol,
      createdAt: new Date().toISOString(),
    };

    const prompt = await buildTradeAnalyzerPrompt({
      strategyName: strategy?.name ?? null,
      strategyRules: strategy?.rules ?? [],
      asset: assetSymbol,
      tradeType: data.trade_type,
      side: data.side,
      amountSpent: data.amount_spent,
      entry: data.entry_price,
      target: data.target_price ?? null,
      stop: data.stop_price ?? null,
      timeframe: data.timeframe_code,
    });

    const { text, model, prompt: usedPrompt, usage } =
      await analyzeTradeWithChart({
        imageUrl,
        prompt,
        context: { overlay: snapshot },
      });

    const MAX_TEXT = 65000,
      MAX_URL = 2048;
    const safeText = (s: string) => (s.length > MAX_TEXT ? s.slice(0, MAX_TEXT) : s);
    const safeUrl = (s: string) => (s.length > MAX_URL ? s.slice(0, MAX_URL) : s);

    const saved = await prisma.trade_pre_analysis.create({
      data: {
        account_id: session.accountId, 
        strategy_id: strategy?.id ?? null,
        asset_symbol: assetSymbol,
        trade_type: data.trade_type === "spot" ? 1 : 2,
        side: JournalEntrySide[data.side],
        timeframe_code: data.timeframe_code.toUpperCase(),
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
    });

    await recordAiUsage({
      kind: "trade",
      model,
      inputTokens: usage.input,
      outputTokens: usage.output,
      accountId: Number.isFinite(accountIdNum) ? accountIdNum : null,
      preAnalysisId: saved.id,
      meta: { asset: assetSymbol, timeframe: data.timeframe_code, strategy_id: strategy?.id ?? null },
    });

    return NextResponse.json({
      id: saved.id,
      imageUrl,
      analysis: text,
      createdAt: saved.created_at,
      snapshot,
    });
  } catch (err) {
    console.error("[trade-analyzer] POST failed:", err);
    const message = err instanceof Error ? err.message : "Internal error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
