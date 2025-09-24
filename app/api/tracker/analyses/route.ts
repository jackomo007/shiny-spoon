import { NextRequest, NextResponse } from "next/server"
import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()

export async function GET(req: NextRequest) {
  const trackerId = req.nextUrl.searchParams.get("trackerId")
  if (!trackerId) return NextResponse.json([], { status: 200 })

  const rows = await prisma.chart_analysis.findMany({
    where: { tracker_id: trackerId },
    orderBy: { created_at: "desc" },
    select: {
      id: true,
      image_url: true,
      analysis_text: true,
      created_at: true,
      overlay_snapshot: true,
    },
    take: 10,
  })

  return NextResponse.json(rows)
}
