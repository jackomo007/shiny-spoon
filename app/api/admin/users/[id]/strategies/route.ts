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

  const rows = await prisma.strategy.findMany({
    where: { account_id: { in: accIds } },
    include: { strategy_rules: { include: { rule: true } } },
    orderBy: { date_created: "desc" },
  })
  const items = rows.map(s => ({
    id: s.id, name: s.name, date_created: s.date_created,
    rules: s.strategy_rules.map(sr => sr.rule.title)
  }))
  return NextResponse.json({ items })
}
