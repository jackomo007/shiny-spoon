import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { z } from "zod"
import { getActiveAccountId } from "@/lib/account"
import { Prisma } from "@prisma/client"
import { getDefaultStrategyId, isValidAssetName, qtyFrom } from "@/lib/trade-helpers"

type Status = "in_progress" | "win" | "loss" | "break_even"
const TIMEFRAME_RE = /^\d+(S|M|H|D|W|Y)$/

const BaseSchema = z.object({
  strategy_id: z.string().min(1).optional(),
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
  timeframe_code: z.string().regex(TIMEFRAME_RE, "Invalid timeframe"),
  buy_fee: z.number().nonnegative().default(0),
  sell_fee: z.number().nonnegative().optional(),
  trading_fee: z.number().nonnegative().optional(),
  strategy_rule_match: z.number().int().min(0).max(999).optional().default(0),
  notes_entry: z.string().optional().nullable(),
  notes_review: z.string().optional().nullable(),
  futures: z.object({
    leverage: z.number().int().min(1),
    liquidation_price: z.number().positive().optional().nullable(),
  }).optional(),
})
.superRefine((v, ctx) => {
  if (v.amount_spent == null && v.amount == null) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["amount_spent"], message: "Required" })
  const t = Number(v.trade_type)
  if (t === 2 && !v.futures) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["futures"], message: "Futures data required" })
  if (t === 1 && !["buy", "sell"].includes(v.side)) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["side"], message: "Spot trades must be buy/sell" })
  if (t === 2 && !["long", "short"].includes(v.side)) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["side"], message: "Futures trades must be long/short" })
  const dt = new Date(v.trade_datetime)
  const now = new Date()
  if (isNaN(dt.getTime()) || dt.getTime() > now.getTime() + 2 * 60 * 1000) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["trade_datetime"], message: "Trade time cannot be in the future" })
})
.transform(v => ({
  ...v,
  trade_type: Number(v.trade_type),
  amount_spent: v.amount_spent ?? v.amount!,
}))

export async function PUT(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params

  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const userId = Number(session.user.id)
  const accountId = await getActiveAccountId(userId)
  if (!accountId) return NextResponse.json({ error: "Active account not found" }, { status: 404 })

  const parsed = BaseSchema.safeParse(await req.json())
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  const data = parsed.data

  if (!(await isValidAssetName(data.asset_name))) {
    return NextResponse.json({ error: "Invalid asset symbol (use e.g. BTCUSDT or a verified symbol)" }, { status: 400 })
  }

  const existing = await prisma.journal_entry.findFirst({ where: { id, account_id: accountId } })
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 })

  const strategyId = data.strategy_id ?? await getDefaultStrategyId(accountId)
  const okStrategy = await prisma.strategy.findFirst({ where: { id: strategyId, account_id: accountId }, select: { id: true } })
  if (!okStrategy) return NextResponse.json({ error: "Strategy not found" }, { status: 404 })

  const tradeType = data.trade_type
  const amountQty = qtyFrom({ amountSpent: data.amount_spent, entryPrice: data.entry_price, tradeType, leverage: data.futures?.leverage })

  const statusToPersist: Status = data.status as Status
  const exitToPersist = data.exit_price === undefined ? (existing.exit_price as number | null) : (data.exit_price ?? null)
  const sellFeeToPersist = (data.sell_fee != null ? Number(data.sell_fee) : undefined)

  const updated = await prisma.$transaction(async (tx) => {
    const u = await tx.journal_entry.update({
      where: { id },
      data: {
        trade_type: tradeType,
        asset_name: data.asset_name.toUpperCase(),
        trade_datetime: new Date(data.trade_datetime),
        side: data.side,
        amount_spent: data.amount_spent,
        amount: amountQty,
        status: statusToPersist,
        strategy_id: strategyId,
        notes_entry: data.notes_entry ?? null,
        notes_review: data.notes_review ?? null,
        timeframe_code: data.timeframe_code,
        buy_fee: Number(data.buy_fee ?? 0),
        ...(sellFeeToPersist !== undefined ? { sell_fee: sellFeeToPersist } : {}),
        trading_fee: Number(data.trading_fee ?? 0),
        strategy_rule_match: data.strategy_rule_match ?? 0,
        entry_price: data.entry_price,
        exit_price: exitToPersist,
        stop_loss_price: data.stop_loss_price ?? null,
      },
      select: { id: true, status: true, exit_price: true, trading_fee: true },
    })

    if (tradeType === 1) {
      await tx.futures_trade.deleteMany({ where: { journal_entry_id: id } })
      const hasSpot = await tx.spot_trade.findFirst({ where: { journal_entry_id: id } })
      if (!hasSpot) await tx.spot_trade.create({ data: { journal_entry_id: id } })
    } else {
      await tx.spot_trade.deleteMany({ where: { journal_entry_id: id } })
      const f = data.futures!
      const marginUsed = data.amount_spent
      const existF = await tx.futures_trade.findFirst({ where: { journal_entry_id: id } })
      if (existF) {
        await tx.futures_trade.update({
          where: { id: existF.id },
          data: { leverage: f.leverage, liquidation_price: f.liquidation_price ?? null, margin_used: marginUsed },
        })
      } else {
        await tx.futures_trade.create({
          data: { journal_entry_id: id, leverage: f.leverage, liquidation_price: f.liquidation_price ?? null, margin_used: marginUsed },
        })
      }
    }

    return u
  })

  return NextResponse.json({
    id: updated.id,
    status: updated.status as Status,
    exit_price: updated.exit_price != null ? Number(updated.exit_price) : null,
    trading_fee: Number(updated.trading_fee ?? 0),
  })
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
  await prisma.portfolio_trade.deleteMany({ where: { account_id: accountId, note: `[JE:${id}]` } })

  return NextResponse.json({ ok: true })
}
