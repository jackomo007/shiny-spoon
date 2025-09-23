import { NextRequest, NextResponse } from "next/server"
import { listAnalyses } from "@/services/tracker.service"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const trackerId = req.nextUrl.searchParams.get("trackerId")
  if (!trackerId) {
    return NextResponse.json({ error: "trackerId required" }, { status: 400 })
  }

  const data = await listAnalyses(trackerId)
  return NextResponse.json(data)
}
