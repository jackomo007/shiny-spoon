import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.isAdmin) return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  const { id } = await params
  const uid = Number(id)

  const accounts = await prisma.account.findMany({ where: { user_id: uid }, select: { id: true } })
  const accIds = accounts.map(a => a.id)
  const entries = await prisma.journal_entry.findMany({
    where: { account_id: { in: accIds } },
    orderBy: { trade_datetime: "desc" },
    take: 100,
    select: { id: true, asset_name: true, trade_type: true, side: true, status: true, trade_datetime: true, amount_spent: true, entry_price: true, exit_price: true }
  })
  return NextResponse.json({ items: entries })
}
