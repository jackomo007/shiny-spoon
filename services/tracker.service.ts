import { PrismaClient, timeframe } from "@prisma/client"
import { captureTradingView } from "@/lib/tradingview-screenshot"
import { uploadPng } from "@/lib/s3"
import { analyzeChartImage } from "@/lib/ai"

const prisma = new PrismaClient()

export type TF = "h1" | "h4" | "d1"
const LIMIT_PER_TRACKER = 10

export function tfToTvInterval(tf: TF): "60" | "240" | "D" {
  return tf === "h1" ? "60" : tf === "h4" ? "240" : "D"
}
export function tfToMs(tf: TF) {
  if (tf === "h1") return 60 * 60 * 1000
  if (tf === "h4") return 4 * 60 * 60 * 1000
  return 24 * 60 * 60 * 1000
}

export async function addCoinToAccount(opts: {
  accountId: string
  tvSymbol: string
  displaySymbol: string
  tf: TF
}) {
  const tracker = await prisma.chart_tracker.upsert({
    where: { tv_symbol_tf: { tv_symbol: opts.tvSymbol, tf: opts.tf as timeframe } },
    create: {
      tv_symbol: opts.tvSymbol,
      display_symbol: opts.displaySymbol,
      tf: opts.tf as timeframe,
    },
    update: { active: true },
  })

  await prisma.chart_subscription.upsert({
    where: { account_id_tracker_id: { account_id: opts.accountId, tracker_id: tracker.id } },
    create: { account_id: opts.accountId, tracker_id: tracker.id },
    update: {},
  })

  return tracker
}

export async function removeCoinFromAccount(accountId: string, trackerId: string) {
  await prisma.chart_subscription.delete({
    where: { account_id_tracker_id: { account_id: accountId, tracker_id: trackerId } },
  })
  const rest = await prisma.chart_subscription.count({ where: { tracker_id: trackerId } })
  if (rest === 0) await prisma.chart_tracker.update({ where: { id: trackerId }, data: { active: false } })
}

export async function listAccountTrackers(accountId: string) {
  return prisma.chart_subscription.findMany({
    where: { account_id: accountId },
    include: { tracker: true },
    orderBy: { created_at: "desc" },
  })
}

export async function listAnalyses(trackerId: string, take = LIMIT_PER_TRACKER) {
  return prisma.chart_analysis.findMany({
    where: { tracker_id: trackerId },
    orderBy: { created_at: "desc" },
    take,
  })
}

export async function runAnalysisForTracker(trackerId: string) {
  const tracker = await prisma.chart_tracker.findUniqueOrThrow({ where: { id: trackerId } })
  if (!tracker.active) return null

  const png = await captureTradingView(tracker.tv_symbol, tfToTvInterval(tracker.tf as TF))
  const imageUrl = await uploadPng(png)

  const { text, model, prompt } = await analyzeChartImage(imageUrl)

  await prisma.chart_analysis.create({
    data: {
      tracker_id: tracker.id,
      image_url: imageUrl,
      analysis_text: text,
      model_used: model,
      prompt_used: prompt,
    },
  })

  await prisma.chart_tracker.update({ where: { id: tracker.id }, data: { last_run_at: new Date() } })

  const extras = await prisma.chart_analysis.findMany({
    where: { tracker_id: tracker.id },
    orderBy: { created_at: "desc" },
    skip: LIMIT_PER_TRACKER,
    select: { id: true },
  })
  if (extras.length) {
    await prisma.chart_analysis.deleteMany({ where: { id: { in: extras.map(e => e.id) } } })
  }
}

export async function findDueTrackers(now = new Date()) {
  const all = await prisma.chart_tracker.findMany({ where: { active: true } })
  return all.filter(t => {
    const last = t.last_run_at?.getTime() ?? 0
    return now.getTime() - last >= tfToMs(t.tf as TF)
  })
}
