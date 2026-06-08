import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { getActiveAccountId } from "@/lib/account"
import { z } from "zod"
import { Prisma } from "@prisma/client"

const BodySchema = z.object({
  name: z.string().min(1),
  description: z.string().optional().nullable(),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional().default("#6B7280"),
})

function parseRange(searchParams: URLSearchParams) {
  const end = searchParams.get("end") ? new Date(searchParams.get("end")!) : new Date()
  const start = searchParams.get("start")
    ? new Date(searchParams.get("start")!)
    : new Date(new Date().setMonth(end.getMonth() - 6))
  start.setHours(0, 0, 0, 0)
  end.setHours(23, 59, 59, 999)
  return { start, end }
}

function calcPnL(row: {
  side: "buy" | "sell" | "long" | "short"
  trade_type: 1 | 2
  entry_price: number
  exit_price: number | null
  amount_spent: number
}) {
  if (row.exit_price == null) return 0
  const qty = row.amount_spent / row.entry_price
  const diff =
    row.side === "buy" || row.side === "long"
      ? row.exit_price - row.entry_price
      : row.entry_price - row.exit_price
  return diff * qty
}

function calcRR(row: {
  entry_price: number
  stop_loss_price: number | null
  exit_price: number | null
}) {
  const { entry_price: ep, stop_loss_price: sl, exit_price: ex } = row
  if (sl == null || ex == null) return null
  const risk = Math.abs(ep - sl)
  const reward = Math.abs(ex - ep)
  if (!risk || !reward) return null
  return reward / risk
}

export async function GET(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const userId = Number(session.user.id)
  const accountId = await getActiveAccountId(userId)
  if (!accountId) {
    return NextResponse.json({ error: "Account not found" }, { status: 404 })
  }

  const { searchParams } = new URL(req.url)
  const { start, end } = parseRange(searchParams)

  const items = await prisma.tag.findMany({
    where: { account_id: accountId },
    orderBy: { name: "asc" },
    include: {
      entries: {
        where: {
          journal_entry: {
            account_id: accountId,
            trade_datetime: { gte: start, lte: end },
          },
        },
        include: {
          journal_entry: {
            select: {
              id: true,
              status: true,
              side: true,
              trade_type: true,
              entry_price: true,
              exit_price: true,
              amount_spent: true,
              stop_loss_price: true,
            },
          },
        },
      },
    },
  })

  const mapped = items.map((tag) => {
    const trades = tag.entries.map((entry) => entry.journal_entry)
    const tradesUsed = trades.length
    const wins = trades.filter((trade) => trade.status === "win").length
    const winRate = tradesUsed ? Math.round((wins / tradesUsed) * 100) : 0
    const pnl = trades.reduce(
      (acc, trade) =>
        acc +
        calcPnL({
          side: trade.side as "buy" | "sell" | "long" | "short",
          trade_type: trade.trade_type as 1 | 2,
          entry_price: Number(trade.entry_price),
          exit_price: trade.exit_price != null ? Number(trade.exit_price) : null,
          amount_spent: Number(trade.amount_spent),
        }),
      0,
    )
    const rrs = trades
      .map((trade) =>
        calcRR({
          entry_price: Number(trade.entry_price),
          stop_loss_price:
            trade.stop_loss_price != null ? Number(trade.stop_loss_price) : null,
          exit_price: trade.exit_price != null ? Number(trade.exit_price) : null,
        }),
      )
      .filter((rr): rr is number => rr != null)
    const avgRR = rrs.length ? rrs.reduce((acc, rr) => acc + rr, 0) / rrs.length : null

    return {
      id: tag.id,
      name: tag.name,
      description: tag.description,
      color: tag.color,
      date_created: tag.created_at,
      tradesUsed,
      winRate,
      avgRR: avgRR != null ? avgRR.toFixed(2) : "N/A",
      pnl: Number(pnl.toFixed(2)),
    }
  })

  const mostUsed = mapped.reduce<{ id: string | null; count: number }>(
    (acc, item) => (item.tradesUsed > acc.count ? { id: item.id, count: item.tradesUsed } : acc),
    { id: null, count: -1 },
  )

  const topPerforming = mapped.reduce<{ id: string | null; value: number }>(
    (acc, item) => (item.pnl > acc.value ? { id: item.id, value: item.pnl } : acc),
    { id: null, value: -Infinity },
  )

  return NextResponse.json({
    items: mapped,
    summary: {
      topPerformingId: topPerforming.id,
      mostUsedId: mostUsed.id,
    },
    range: { start, end },
  })
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const userId = Number(session.user.id)
  const accountId = await getActiveAccountId(userId)
  if (!accountId) {
    return NextResponse.json({ error: "Account not found" }, { status: 404 })
  }

  const parsed = BodySchema.safeParse(await req.json())
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const name = parsed.data.name.trim()
  const description = (parsed.data.description ?? "").trim() || null
  const color = parsed.data.color
  if (!name) {
    return NextResponse.json({ error: "Name is required" }, { status: 400 })
  }

  try {
    const created = await prisma.tag.create({
      data: {
        name,
        description,
        color,
        account_id: accountId,
      },
      select: { id: true, name: true, description: true, color: true },
    })

    return NextResponse.json(created, { status: 201 })
  } catch (err: unknown) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      const existing = await prisma.tag.findFirst({
        where: { account_id: accountId, name },
        select: { id: true, name: true, description: true, color: true },
      })
      if (existing) {
        return NextResponse.json(existing, { status: 200 })
      }
    }
    return NextResponse.json({ error: "Failed to create tag" }, { status: 500 })
  }
}
