import { timeframe } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { uploadPng } from "@/lib/s3";
import { analyzeChartImage } from "@/lib/ai-analyzer";
import { fetchKlines, type BinanceInterval } from "@/lib/klines";
import { generateCandlePng } from "@/lib/chart-image";
import { recordAiUsage } from "@/lib/ai-usage";

export type TF = "h1" | "h4" | "d1";
const LIMIT_PER_TRACKER = 10;

function tfToBinance(tf: TF): BinanceInterval {
  if (tf === "h1") return "1h";
  if (tf === "h4") return "4h";
  return "1d";
}

export function tfToMs(tf: TF) {
  if (tf === "h1") return 60 * 60 * 1000;
  if (tf === "h4") return 4 * 60 * 60 * 1000;
  return 24 * 60 * 60 * 1000;
}

export async function runAnalysisForTracker(trackerId: string) {
  const tracker = await prisma.chart_tracker.findUniqueOrThrow({ where: { id: trackerId } });
  if (!tracker.active) return null;

  await prisma.chart_tracker.update({
    where: { id: tracker.id },
    data: { last_run_at: new Date() },
  });

  const symbol = (tracker.display_symbol || tracker.tv_symbol.replace(/^.*:/, "")).toUpperCase();
  const binanceInterval = tfToBinance(tracker.tf as TF);

  try {
    const candles = await fetchKlines(symbol, binanceInterval, 150);

    const png = await generateCandlePng(candles, {
      width: 1280,
      height: 720,
      symbol,
      timeframeLabel: tracker.tf,
      title: `${symbol} · ${tracker.tf.toUpperCase()}`,
    });

    const imageUrl = await uploadPng(png);

    const last = candles[candles.length - 1];
    const first = candles[0];
    const diff = last.close - first.open;
    const pct = (diff / first.open) * 100;
    const avgVol =
      candles.slice(-30).reduce((s, c) => s + c.volume, 0) /
      Math.max(1, Math.min(30, candles.length));

    const snapshot = {
      symbol,
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

    const { text, model, prompt, usage } = await analyzeChartImage(imageUrl);

    await prisma.chart_analysis.create({
      data: {
        tracker_id: tracker.id,
        image_url: imageUrl,
        analysis_text: text,
        model_used: model,
        prompt_used: prompt,
        overlay_snapshot: snapshot,
      },
    });

    await recordAiUsage({
      kind: "chart",
      model,
      inputTokens: usage.input,
      outputTokens: usage.output,
      trackerId: tracker.id,
      accountId: null,
      meta: { tvSymbol: tracker.tv_symbol, tf: tracker.tf },
    });

    const extras = await prisma.chart_analysis.findMany({
      where: { tracker_id: tracker.id },
      orderBy: { created_at: "desc" },
      skip: LIMIT_PER_TRACKER,
      select: { id: true },
    });
    if (extras.length) {
      await prisma.chart_analysis.deleteMany({ where: { id: { in: extras.map(e => e.id) } } });
    }
  } catch (err) {
    console.error("[ANALYZE FAIL]", tracker.id, tracker.tv_symbol, tracker.tf, err);
    throw err;
  }
}

export async function addCoinToAccountMany(opts: {
  accountId: string;
  tvSymbol: string;
  displaySymbol: string;
  tfs: TF[];
}) {
  const trackers: { id: string; tf: TF }[] = [];

  for (const tf of opts.tfs) {
    const tracker = await prisma.chart_tracker.upsert({
      where: { tv_symbol_tf: { tv_symbol: opts.tvSymbol, tf: tf as timeframe } },
      create: {
        tv_symbol: opts.tvSymbol,
        display_symbol: opts.displaySymbol,
        tf: tf as timeframe,
      },
      update: { active: true },
    });

    await prisma.chart_subscription.upsert({
      where: { account_id_tracker_id: { account_id: opts.accountId, tracker_id: tracker.id } },
      create: { account_id: opts.accountId, tracker_id: tracker.id },
      update: {},
    });

    trackers.push({ id: tracker.id, tf });
  }

  return { trackers };
}

export async function addCoinToAccount(opts: {
  accountId: string;
  tvSymbol: string;
  displaySymbol: string;
  tf: TF;
}) {
  const tracker = await prisma.chart_tracker.upsert({
    where: { tv_symbol_tf: { tv_symbol: opts.tvSymbol, tf: opts.tf as timeframe } },
    create: {
      tv_symbol: opts.tvSymbol,
      display_symbol: opts.displaySymbol,
      tf: opts.tf as timeframe,
    },
    update: { active: true },
  });

  await prisma.chart_subscription.upsert({
    where: { account_id_tracker_id: { account_id: opts.accountId, tracker_id: tracker.id } },
    create: { account_id: opts.accountId, tracker_id: tracker.id },
    update: {},
  });

  return tracker;
}

export async function removeCoinFromAccount(accountId: string, trackerId: string) {
  await prisma.chart_subscription.delete({
    where: { account_id_tracker_id: { account_id: accountId, tracker_id: trackerId } },
  });
  const rest = await prisma.chart_subscription.count({ where: { tracker_id: trackerId } });
  if (rest === 0) {
    await prisma.chart_tracker.update({ where: { id: trackerId }, data: { active: false } });
  }
}

export async function listAccountTrackers(accountId: string) {
  return prisma.chart_subscription.findMany({
    where: { account_id: accountId },
    include: { tracker: true },
    orderBy: { created_at: "desc" },
  });
}

export async function listAnalyses(trackerId: string, take = 10) {
  return prisma.chart_analysis.findMany({
    where: { tracker_id: trackerId },
    orderBy: { created_at: "desc" },
    take,
  });
}

export async function findDueTrackers(now = new Date()) {
  const all = await prisma.chart_tracker.findMany({ where: { active: true } });
  return all.filter(t => {
    const last = t.last_run_at?.getTime() ?? 0;
    return now.getTime() - last >= tfToMs(t.tf as TF);
  });
}
