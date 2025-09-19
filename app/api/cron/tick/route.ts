import { NextResponse } from "next/server"
import { findDueTrackers, runAnalysisForTracker } from "@/services/tracker.service"

export const runtime = "nodejs" 
export const dynamic = "force-dynamic"
export const revalidate = 0
export const maxDuration = 60

export async function GET(req: Request) {
  const isFromVercelCron = req.headers.get("x-vercel-cron")
  if (!isFromVercelCron) {
    const key = new URL(req.url).searchParams.get("key")
    if (!key || key !== process.env.CRON_SECRET) {
      return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 })
    }
  }

  try {
    const due = await findDueTrackers()
    let ok = 0, fail = 0

    for (const t of due) {
      try {
        await runAnalysisForTracker(t.id)
        ok++
      } catch (e) {
        console.error("[cron] fail:", t.id, e)
        fail++
      }
    }

    return NextResponse.json({ ok: true, ran: ok, failed: fail })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ ok: false, error: msg }, { status: 500 })
  }
}
