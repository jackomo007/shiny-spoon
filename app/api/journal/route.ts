import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { z } from "zod"
import { getActiveAccountId } from "@/lib/account"

const CreateSchema = z.object({
  asset_name: z.string().min(1),
  trade_type: z.union([z.number(), z.string()]), // 1=spot, 2=futures
  trade_datetime: z.string().min(1),             // ISO
  side: z.enum(["buy", "sell", "long", "short"]),
  status: z.enum(["in_progress", "win", "loss", "break_even"]),
  amount: z.number().positive(),
  strategy_id: z.string().min(1),
  notes_entry: z.string().optional().nullable(),
  notes_review: z.string().optional().nullable(),
  strategy_rule_match: z.number().int().min(0).max(4).default(0),
  entry_price: z.number().positive(),
  exit_price: z.number().positive().optional().nullable(),
  futures: z.object({
    leverage: z.number().int().min(1),
    margin_used: z.number().nonnegative(),
    liquidation_price: z.number().positive(),
  }).optional(),
})

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const userId = Number(session.user.id)
  const accountId = await getActiveAccountId(userId)

  const rows = await prisma.journal_entry.findMany({
    where: { account_id: accountId },
    include: { spot_trade: true, futures_trade: true },
    orderBy: { trade_datetime: "desc" },
    take: 1000,
  })

  const items = rows.map(r => ({
    id: r.id,
    asset_name: r.asset_name,
    trade_type: r.trade_type,
    side: r.side,
    status: r.status,
    entry_price: Number(r.entry_price),
    exit_price: r.exit_price != null ? Number(r.exit_price) : null,
    amount: Number(r.amount),
    date: r.trade_datetime.toISOString(),
    strategy_id: r.strategy_id,
    notes_entry: r.notes_entry ?? null,
    notes_review: r.notes_review ?? null,
    strategy_rule_match: r.strategy_rule_match,
    leverage: r.futures_trade[0]?.leverage ?? null,
    margin_used: r.futures_trade[0] ? Number(r.futures_trade[0].margin_used) : null,
    liquidation_price: r.futures_trade[0] ? Number(r.futures_trade[0].liquidation_price) : null,
  }))

  return NextResponse.json(items)
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await req.json()
  const parsed = CreateSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const data = parsed.data
  const userId = Number(session.user.id)
  const accountId = await getActiveAccountId(userId)
  const tradeType = Number(data.trade_type)

  // evita criar journal com strategy de outra conta
  const okStrategy = await prisma.strategy.findFirst({
    where: { id: data.strategy_id, account_id: accountId },
    select: { id: true },
  })
  if (!okStrategy) return NextResponse.json({ error: "Strategy not found" }, { status: 404 })

  const created = await prisma.$transaction(async (tx) => {
    const je = await tx.journal_entry.create({
      data: {
        account_id: accountId,
        trade_type: tradeType,
        asset_name: data.asset_name,
        trade_datetime: new Date(data.trade_datetime),
        side: data.side,
        status: data.status,
        amount: data.amount,
        strategy_id: data.strategy_id,
        notes_entry: data.notes_entry ?? null,
        notes_review: data.notes_review ?? null,
        strategy_rule_match: data.strategy_rule_match ?? 0,
        entry_price: data.entry_price,
        exit_price: data.exit_price ?? null,
      },
    })

    if (tradeType === 1) {
      await tx.spot_trade.create({ data: { journal_entry_id: je.id } })
    } else {
      const f = data.futures
      if (!f) throw new Error("Futures data required")
      await tx.futures_trade.create({
        data: {
          journal_entry_id: je.id,
          leverage: f.leverage,
          margin_used: f.margin_used,
          liquidation_price: f.liquidation_price,
        },
      })
    }

    return je
  })

  return NextResponse.json({ id: created.id })
}
