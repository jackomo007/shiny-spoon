import { NextRequest, NextResponse } from "next/server"
import { findDueTrackers, runAnalysisForTracker } from "@/services/tracker.service"
import pLimit from "p-limit"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

type TrackerReport = {
  trackerId: string; tv_symbol: string; tf: string; ok: boolean; error?: string
}

export async function POST(req: NextRequest) {
  const key = req.headers.get("x-cron-key")
  const devKey =
    process.env.NODE_ENV !== "production" ? process.env.NEXT_PUBLIC_DEV_CRON_SECRET : undefined

  if (key !== process.env.CRON_SECRET && key !== devKey) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const due = await findDueTrackers()
  const limit = pLimit(2)

  const reports = await Promise.allSettled(
    due.map(t =>
      limit(async (): Promise<TrackerReport> => {
        try {
          await runAnalysisForTracker(t.id)
          return { trackerId: t.id, tv_symbol: t.tv_symbol, tf: t.tf, ok: true }
        } catch (e: unknown) {
          const message =
            e instanceof Error ? e.message : typeof e === "string" ? e : "Unknown error"
          return { trackerId: t.id, tv_symbol: t.tv_symbol, tf: t.tf, ok: false, error: message }
        }
      })
    )
  )

  console.log('REPORTS', reports)
  console.log('DUE', due)
  console.warn(`Processed ${reports.length} trackers, ${due.length} were due.`)
  

  const flat: TrackerReport[] = reports.map(r =>
    r.status === "fulfilled" ? r.value
      : { trackerId: "unknown", tv_symbol: "", tf: "", ok: false, error: String(r.reason) }
  )

  console.warn(`OK ${flat.filter(r => r.ok).length}, FAIL ${flat.filter(r => !r.ok).length}`)

  return NextResponse.json({
    queued: due.length,
    ok: flat.filter(r => r.ok).length,
    fail: flat.filter(r => !r.ok).length,
    results: flat,
  })
}
