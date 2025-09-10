import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { z } from "zod"
import { getActiveAccountId } from "@/lib/account"

const BaseSchema = z.object({
  strategy_id: z.string().min(1),
  asset_name: z.string().min(1),
  trade_type: z.union([z.number(), z.string()]),
  trade_datetime: z.string().min(1),
  side: z.enum(["buy", "sell", "long", "short"]),
  status: z.enum(["in_progress", "win", "loss", "break_even"]),
  entry_price: z.number().positive(),
  exit_price: z.number().positive().optional().nullable(),
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

  if (t === 1 && !["buy", "sell"].includes(v.side)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["side"], message: "Spot trades must be buy/sell" })
  }
  if (t === 2 && !["long", "short"].includes(v.side)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["side"], message: "Futures trades must be long/short" })
  }

  const dt = new Date(v.trade_datetime)
  const now = new Date()
  if (isNaN(dt.getTime()) || dt.getTime() > now.getTime() + 2 * 60 * 1000) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["trade_datetime"], message: "Trade time cannot be in the future" })
  }
})
.transform(v => ({
  ...v,
  trade_type: Number(v.trade_type),
  amount_spent: v.amount_spent ?? v.amount!,
}))

const UpdateSchema = BaseSchema

function qtyFrom(amountSpent: number, entryPrice: number): number {
  if (entryPrice <= 0) return 0
  return amountSpent / entryPrice
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

// Next.js 15: params como Promise
export async function PUT(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params

  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const userId = Number(session.user.id)
  const accountId = await getActiveAccountId(userId)
  if (!accountId) return NextResponse.json({ error: "Active account not found" }, { status: 404 })

  const parsed = UpdateSchema.safeParse(await req.json())
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  const data = parsed.data

  if (!(await isValidSymbol(data.asset_name))) {
    return NextResponse.json({ error: "Invalid asset symbol" }, { status: 400 })
  }

  const existing = await prisma.journal_entry.findFirst({ where: { id, account_id: accountId } })
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 })

  const okStrategy = await prisma.strategy.findFirst({
    where: { id: data.strategy_id, account_id: accountId },
    select: { id: true },
  })
  if (!okStrategy) return NextResponse.json({ error: "Strategy not found" }, { status: 404 })

  const amountQty = qtyFrom(data.amount_spent, data.entry_price)
  const tradeType = data.trade_type

  await prisma.$transaction(async (tx) => {
    await tx.journal_entry.update({
      where: { id },
      data: {
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
      },
    })

    if (tradeType === 1) {
      await tx.futures_trade.deleteMany({ where: { journal_entry_id: id } })
      const hasSpot = await tx.spot_trade.findFirst({ where: { journal_entry_id: id } })
      if (!hasSpot) await tx.spot_trade.create({ data: { journal_entry_id: id } })
    } else {
      await tx.spot_trade.deleteMany({ where: { journal_entry_id: id } })
      const f = data.futures!
      const marginUsed = data.amount_spent / Math.max(1, f.leverage)
      const existF = await tx.futures_trade.findFirst({ where: { journal_entry_id: id } })
      if (existF) {
        await tx.futures_trade.update({
          where: { id: existF.id },
          data: { leverage: f.leverage, liquidation_price: f.liquidation_price, margin_used: marginUsed },
        })
      } else {
        await tx.futures_trade.create({
          data: { journal_entry_id: id, leverage: f.leverage, liquidation_price: f.liquidation_price, margin_used: marginUsed },
        })
      }
    }
  })

  return NextResponse.json({ ok: true })
}

export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params

  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const userId = Number(session.user.id)
  const accountId = await getActiveAccountId(userId)
  if (!accountId) return NextResponse.json({ error: "Active account not found" }, { status: 404 })

  const existing = await prisma.journal_entry.findFirst({ where: { id, account_id: accountId } })
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 })

  await prisma.journal_entry.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
