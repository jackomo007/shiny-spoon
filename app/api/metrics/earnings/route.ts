import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { Prisma, journal_entry_status, journal_entry_side as EntrySide } from "@prisma/client"

function toNum(x: Prisma.Decimal | number | null | undefined): number {
  if (x == null) return 0
  return typeof x === "number" ? x : Number(x)
}

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.accountId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const today = new Date()
  const start = new Date(today)
  start.setMonth(start.getMonth() - 11)
  start.setHours(0, 0, 0, 0)

  const rows = await prisma.journal_entry.findMany({
    where: {
      account_id: session.accountId,
      trade_datetime: { gte: start, lte: today },
      exit_price: { not: null },
      status: { in: [journal_entry_status.win, journal_entry_status.loss, journal_entry_status.break_even] },
    },
    select: {
      trade_datetime: true,
      side: true,
      entry_price: true,
      exit_price: true,
      amount: true,
      buy_fee: true,
      sell_fee: true,
      status: true,
    },
    orderBy: { trade_datetime: "asc" },
  })

  const buckets = new Map<string, number>()

  for (const r of rows) {
    const entry = toNum(r.entry_price)
    const exit = toNum(r.exit_price)
    const qty = toNum(r.amount)
    const fees = toNum(r.buy_fee) + toNum(r.sell_fee)

    let pnl = 0
    if (r.side === EntrySide.buy || r.side === EntrySide.long) {
      pnl = (exit - entry) * qty
    } else {
      pnl = (entry - exit) * qty
    }
    pnl -= fees
    if (r.status === journal_entry_status.break_even) pnl = 0

    const d = new Date(r.trade_datetime)
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
    buckets.set(key, (buckets.get(key) ?? 0) + pnl)
  }

  const out: { month: string; earnings: number }[] = []
  for (let i = 11; i >= 0; i--) {
    const d = new Date(today)
    d.setMonth(d.getMonth() - i)
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
    out.push({ month: key, earnings: Number((buckets.get(key) ?? 0).toFixed(2)) })
  }

  return NextResponse.json({ items: out })
}
