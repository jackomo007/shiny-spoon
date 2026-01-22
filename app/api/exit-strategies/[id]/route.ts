import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { buildExitStrategyDetails } from "@/services/exit-strategy.service"

export const dynamic = "force-dynamic"

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params

    const session = await getServerSession(authOptions)
    if (!session?.accountId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const data = await buildExitStrategyDetails(session.accountId, id, 10)
    return NextResponse.json({ data })
  } catch (e) {
    console.error("[GET /api/exit-strategies/[id]] error:", e)
    return NextResponse.json({ error: "Internal error" }, { status: 500 })
  }
}

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params

    const session = await getServerSession(authOptions)
    if (!session?.accountId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const accountId = session.accountId

    const row = await prisma.exit_strategy.findFirst({
      where: { id, account_id: accountId },
      select: { id: true },
    })
    if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 })

    await prisma.exit_strategy.delete({ where: { id } })
    return new Response(null, { status: 204 })
  } catch (e) {
    console.error("[DELETE /api/exit-strategies/[id]] error:", e)
    return NextResponse.json({ error: "Internal error" }, { status: 500 })
  }
}
