import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { PortfolioRepo } from "@/data/repositories/portfolio.repo"

export const dynamic = "force-dynamic"

export async function DELETE(req: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.accountId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { pathname } = new URL(req.url)
    const segments = pathname.split("/").filter(Boolean)
    const raw = segments[segments.length - 1] || ""
    const symbol = decodeURIComponent(raw).trim().toUpperCase()

    if (!symbol) {
      return NextResponse.json({ error: "Invalid symbol" }, { status: 400 })
    }
    if (symbol === "CASH") {
      return NextResponse.json({ error: "Cash cannot be removed" }, { status: 400 })
    }

    const allowed = await PortfolioRepo.canDeleteInitSymbol(session.accountId, symbol)
    if (!allowed) {
      return NextResponse.json(
        { error: "Asset is linked to journal entries and cannot be deleted" },
        { status: 400 }
      )
    }

    await PortfolioRepo.deleteInitPositions(session.accountId, symbol)
    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error("[DELETE /api/portfolio/[symbol]] error:", e)
    return NextResponse.json({ error: "Internal error deleting asset" }, { status: 500 })
  }
}
