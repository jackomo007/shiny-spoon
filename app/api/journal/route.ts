import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { z } from "zod"
import { getActiveAccountId } from "@/lib/account"
import { getActiveJournalId } from "@/lib/journal"

function parseRange(searchParams: URLSearchParams) {
  const end = searchParams.get("end") ? new Date(searchParams.get("end")!) : new Date()
  const start = searchParams.get("start")
    ? new Date(searchParams.get("start")!)
    : new Date(new Date().setMonth(end.getMonth() - 6))
  start.setHours(0, 0, 0, 0)
  end.setHours(23, 59, 59, 999)
  return { start, end }
}

function calcPnl(input: {
  side: "buy" | "sell" | "long" | "short"
  entry: number
  exit: number | null
  amountSpent: number
  leverage?: number | null
  tradeType: 1 | 2
}): number | null {
  if (input.exit == null) return null
  const dir = (input.side === "buy" || input.side === "long") ? 1 : -1
  const change = (input.exit - input.entry) / input.entry
  const notional = input.tradeType === 2
    ? input.amountSpent * Math.max(1, input.leverage ?? 1)
    : input.amountSpent
  return Number((dir * notional * change).toFixed(2))
}

const BaseSchema = z.object({
  strategy_id: z.string().min(1),
  asset_name: z.string().min(1),
  trade_type: z.union([z.number(), z.string()]),
  trade_datetime: z.string().min(1),
  side: z.enum(["buy", "sell", "long", "short"]),
  status: z.enum(["in_progress", "win", "loss", "break_even"]),
  entry_price: z.number().positive(),
  exit_price: z.number().positive().optional().nullable(),
  stop_loss_price: z.number().positive().optional().nullable(),
  amount_spent: z.number().positive().optional(),
  amount: z.number().positive().optional(),
  strategy_rule_match: z.number().int().min(0).max(999).optional().default(0),
  notes_entry: z.string().optional().nullable(),
  notes_review: z.string().optional().nullable(),
  futures: z.object({
    leverage: z.number().int().min(1),
    liquidation_price: z.number().positive(),
  }).optional(),
})
.superRefine((v, ctx) => {
  if (v.amount_spent == null && v.amount == null) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["amount_spent"], message: "Required" })
  }
  const t = Number(v.trade_type)
  if (t === 2 && !v.futures) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["futures"], message: "Futures data required" })
  }
})
.transform(v => ({
  ...v,
  trade_type: Number(v.trade_type),
  amount_spent: v.amount_spent ?? v.amount!,
}))

const CreateSchema = BaseSchema

function qtyFrom(params: { amountSpent: number; entryPrice: number; tradeType: number; leverage?: number }): number {
  const { amountSpent, entryPrice, tradeType, leverage } = params
  if (entryPrice <= 0) return 0
  const notional = tradeType === 2 ? amountSpent * Math.max(1, leverage ?? 1) : amountSpent
  return notional / entryPrice
}

async function isValidSymbol(sym: string): Promise<boolean> {
  const key = process.env.CMC_API_KEY
  if (!key) return true
  const u = `https://pro-api.coinmarketcap.com/v1/cryptocurrency/map?listing_status=active&symbol=${encodeURIComponent(sym)}&limit=1`
  const resp = await fetch(u, { headers: { "X-CMC_PRO_API_KEY": key }, cache: "no-store" })
  if (!resp.ok) return true
  const js = await resp.json() as { data?: Array<{ symbol: string }> }
  return (js.data ?? []).some(d => d.symbol.toUpperCase() === sym.toUpperCase())
}

export async function GET(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const userId = Number(session.user.id)
  const accountId = await getActiveAccountId(userId)
  if (!accountId) return NextResponse.json({ error: "Account not found" }, { status: 404 })

  const { searchParams } = new URL(req.url)
  const { start, end } = parseRange(searchParams)

  const journalId = await getActiveJournalId(userId)

  const rows = await prisma.journal_entry.findMany({
    where: { account_id: accountId, journal_id: journalId, trade_datetime: { gte: start, lte: end } },
    include: { spot_trade: true, futures_trade: true },
    orderBy: { trade_datetime: "desc" },
    take: 1000,
  })

  const items = rows.map(r => {
    const leverage = r.futures_trade[0]?.leverage ?? null
    const pnl = calcPnl({
      side: r.side,
      entry: Number(r.entry_price),
      exit: r.exit_price != null ? Number(r.exit_price) : null,
      amountSpent: Number(r.amount_spent),
      leverage,
      tradeType: r.trade_type as 1 | 2,
    })
    return {
      id: r.id,
      asset_name: r.asset_name,
      trade_type: r.trade_type,
      side: r.side,
      status: r.status,
      entry_price: Number(r.entry_price),
      exit_price: r.exit_price != null ? Number(r.exit_price) : null,
      amount_spent: Number(r.amount_spent),
      date: r.trade_datetime.toISOString(),
      strategy_id: r.strategy_id,
      strategy_rule_match: r.strategy_rule_match,
      notes_entry: r.notes_entry ?? null,
      notes_review: r.notes_review ?? null,
      pnl,
      leverage,
      liquidation_price: r.futures_trade[0]?.liquidation_price != null ? Number(r.futures_trade[0].liquidation_price) : null,
    }
  })

  return NextResponse.json({ items, range: { start, end }, journalId })
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const parsed = CreateSchema.safeParse(await req.json())
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const data = parsed.data
  if (!(await isValidSymbol(data.asset_name))) {
    return NextResponse.json({ error: "Invalid asset symbol" }, { status: 400 })
  }

  const userId = Number(session.user.id)
  const accountId = await getActiveAccountId(userId)
  if (!accountId) return NextResponse.json({ error: "Account not found" }, { status: 404 })

  const journalId = await getActiveJournalId(userId)
  const tradeType = data.trade_type

  const okStrategy = await prisma.strategy.findFirst({
    where: { id: data.strategy_id, account_id: accountId },
    select: { id: true },
  })
  if (!okStrategy) return NextResponse.json({ error: "Strategy not found" }, { status: 404 })

  const created = await prisma.$transaction(async (tx) => {
    const amountQty = qtyFrom({
      amountSpent: data.amount_spent,
      entryPrice: data.entry_price,
      tradeType,
      leverage: data.futures?.leverage,
    })

    const je = await tx.journal_entry.create({
      data: {
        account_id: accountId,
        journal_id: journalId,
        trade_type: tradeType,
        asset_name: data.asset_name,
        trade_datetime: new Date(data.trade_datetime),
        side: data.side,
        status: data.status,
        amount_spent: data.amount_spent,
        amount: amountQty,
        strategy_id: data.strategy_id,
        notes_entry: data.notes_entry ?? null,
        notes_review: data.notes_review ?? null,
        strategy_rule_match: data.strategy_rule_match ?? 0,
        entry_price: data.entry_price,
        exit_price: data.exit_price ?? null,
        stop_loss_price: data.stop_loss_price ?? null,
      },
      select: { id: true },
    })

    if (tradeType === 1) {
      await tx.spot_trade.create({ data: { journal_entry_id: je.id } })
    } else {
      const f = data.futures!
      const marginUsed = data.amount_spent
      await tx.futures_trade.create({
        data: { journal_entry_id: je.id, leverage: f.leverage, liquidation_price: f.liquidation_price, margin_used: marginUsed },
      })
    }

    return je
  })

  return NextResponse.json({ id: created.id })
}
