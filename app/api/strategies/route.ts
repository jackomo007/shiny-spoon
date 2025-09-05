import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { getActiveAccountId } from "@/lib/account"
import { StrategyUpsert } from "@/lib/validators"

function parseRange(searchParams: URLSearchParams) {
  const end = searchParams.get("end") ? new Date(searchParams.get("end")!) : new Date()
  const start = searchParams.get("start")
    ? new Date(searchParams.get("start")!)
    : new Date(new Date().setMonth(end.getMonth() - 6))
  start.setHours(0,0,0,0)
  end.setHours(23,59,59,999)
  return { start, end }
}

function calcPnL(row: {
  side: "buy" | "sell" | "long" | "short"
  entry_price: number
  exit_price: number | null
  amount: number
}) {
  if (row.exit_price == null) return 0
  const diff = (row.side === "buy" || row.side === "long")
    ? (row.exit_price - row.entry_price)
    : (row.entry_price - row.exit_price)
  return diff * row.amount
}

function calcRR(row: {
  entry_price: number
  stop_loss_price: number | null
  take_profit_price: number | null
}) {
  const { entry_price: ep, stop_loss_price: sl, take_profit_price: tp } = row
  if (sl == null || tp == null) return null
  const risk = Math.abs(ep - sl)
  const reward = Math.abs(tp - ep)
  if (!risk || !reward) return null
  return reward / risk
}

export async function GET(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const userId = Number(session.user.id)
  const accountId = await getActiveAccountId(userId)
  if (!accountId) return NextResponse.json({ error: "Account not found" }, { status: 404 })

  const { searchParams } = new URL(req.url)
  const { start, end } = parseRange(searchParams)

  const strategies = await prisma.strategy.findMany({
    where: { account_id: accountId },
    orderBy: { date_created: "desc" },
    include: { strategy_rules: { include: { rule: true } } },
  })

  if (strategies.length === 0) {
    return NextResponse.json({
      items: [],
      summary: { topPerformingId: null, mostUsedId: null },
      range: { start, end },
    })
  }

  const trades = await prisma.journal_entry.findMany({
    where: {
      account_id: accountId,
      trade_datetime: { gte: start, lte: end },
    },
    select: {
      id: true,
      strategy_id: true,
      status: true,
      side: true,
      entry_price: true,
      exit_price: true,
      amount: true,
      stop_loss_price: true,
      take_profit_price: true,
    },
  })

  const grouped = new Map<string, typeof trades>()
  for (const t of trades) {
    if (!grouped.has(t.strategy_id)) grouped.set(t.strategy_id, [])
    grouped.get(t.strategy_id)!.push(t)
  }

  const items = strategies.map(s => {
    const ts = grouped.get(s.id) ?? []
    const tradesUsed = ts.length

    const wins = ts.filter(t => t.status === "win").length
    const winRate = tradesUsed ? Math.round((wins / tradesUsed) * 100) : 0

    const pnls = ts.map(t => calcPnL({
      side: t.side as "buy" | "sell" | "long" | "short",
      entry_price: Number(t.entry_price),
      exit_price: t.exit_price != null ? Number(t.exit_price) : null,
      amount: Number(t.amount),
    }))
    const pnl = pnls.reduce((acc, n) => acc + n, 0)

    const rrs = ts.map(t => calcRR({
      entry_price: Number(t.entry_price),
      stop_loss_price: t.stop_loss_price != null ? Number(t.stop_loss_price) : null,
      take_profit_price: t.take_profit_price != null ? Number(t.take_profit_price) : null,
    })).filter((x): x is number => x != null)

    const avgRR = rrs.length ? (rrs.reduce((a,b)=>a+b,0) / rrs.length) : null

    return {
      id: s.id,
      name: s.name,
      date_created: s.date_created!,
      rules: s.strategy_rules.map(sr => sr.rule.title),
      tradesUsed,
      winRate,
      avgRR: avgRR != null ? avgRR.toFixed(2) : "N/A",
      pnl: Number(pnl.toFixed(2)),
    }
  })

  const mostUsed = items.reduce<{id:string|null; count:number}>(
    (acc, it) => (it.tradesUsed > acc.count ? { id: it.id, count: it.tradesUsed } : acc),
    { id: null, count: -1 }
  )

  const topPerforming = items.reduce<{id:string|null; value:number}>(
    (acc, it) => (it.pnl > acc.value ? { id: it.id, value: it.pnl } : acc),
    { id: null, value: -Infinity }
  )

  return NextResponse.json({
    items,
    summary: {
      topPerformingId: topPerforming.id,
      mostUsedId: mostUsed.id,
    },
    range: { start, end },
  })
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await req.json()
  const parsed = StrategyUpsert.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const userId = Number(session.user.id)
  const accountId = await getActiveAccountId(userId)
  if (!accountId) return NextResponse.json({ error: "Account not found" }, { status: 404 })

  const { name, rules } = parsed.data
  const created = await prisma.$transaction(async (tx) => {
    const st = await tx.strategy.create({ data: { name, account_id: accountId } })
    for (const r of rules) {
      const rule = await tx.rule.upsert({
        where: { title: r.title.trim() },
        update: { description: (r.description ?? "").trim() || null },
        create: { title: r.title.trim(), description: (r.description ?? "").trim() || null },
      })
      await tx.strategy_rule.create({ data: { strategy_id: st.id, rule_id: rule.id } })
    }
    return st
  })
  return NextResponse.json({ id: created.id })
}
