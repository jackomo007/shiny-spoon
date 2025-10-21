import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { getActiveAccountId } from "@/lib/account"

export async function DELETE(_: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params

  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const userId = Number(session.user.id)
  const accountId = await getActiveAccountId(userId)
  if (!accountId) return NextResponse.json({ error: "Account not found" }, { status: 404 })

  const row = await prisma.portfolio_trade.findFirst({ where: { id, account_id: accountId } })
  if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 })

  if (row.note?.startsWith("[JE:") && row.note.endsWith("]")) {
    const jeId = row.note.slice(4, -1)
    try { await prisma.journal_entry.delete({ where: { id: jeId } }) } catch {}
  }

  await prisma.portfolio_trade.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
