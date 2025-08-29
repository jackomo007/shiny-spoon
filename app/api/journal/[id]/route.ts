import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { z } from "zod"
import { getActiveAccountId } from "@/lib/account"

const UpdateSchema = z.object({
  asset_name: z.string().min(1),
  trade_type: z.union([z.number(), z.string()]),
  trade_datetime: z.string().min(1),
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

export async function PUT(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const { id } = await ctx.params
  const userId = Number(session.user.id)
  const accountId = await getActiveAccountId(userId)

  const body = await req.json()
  const parsed = UpdateSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const tradeType = Number(parsed.data.trade_type)

  const existing = await prisma.journal_entry.findFirst({ where: { id, account_id: accountId } })
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 })

  await prisma.$transaction(async (tx) => {
    await tx.journal_entry.update({
      where: { id },
      data: {
        trade_type: tradeType,
        asset_name: parsed.data.asset_name,
        trade_datetime: new Date(parsed.data.trade_datetime),
        side: parsed.data.side,
        status: parsed.data.status,
        amount: parsed.data.amount,
        strategy_id: parsed.data.strategy_id,
        notes_entry: parsed.data.notes_entry ?? null,
        notes_review: parsed.data.notes_review ?? null,
        strategy_rule_match: parsed.data.strategy_rule_match ?? 0,
        entry_price: parsed.data.entry_price,
        exit_price: parsed.data.exit_price ?? null,
      },
    })

    if (tradeType === 1) {
      await tx.futures_trade.deleteMany({ where: { journal_entry_id: id } })
      const spot = await tx.spot_trade.findFirst({ where: { journal_entry_id: id } })
      if (!spot) await tx.spot_trade.create({ data: { journal_entry_id: id } })
    } else {
      await tx.spot_trade.deleteMany({ where: { journal_entry_id: id } })
      const f = parsed.data.futures
      if (!f) throw new Error("Futures data required")
      const existF = await tx.futures_trade.findFirst({ where: { journal_entry_id: id } })
      if (existF) {
        await tx.futures_trade.update({
          where: { id: existF.id },
          data: { leverage: f.leverage, margin_used: f.margin_used, liquidation_price: f.liquidation_price },
        })
      } else {
        await tx.futures_trade.create({
          data: { journal_entry_id: id, leverage: f.leverage, margin_used: f.margin_used, liquidation_price: f.liquidation_price },
        })
      }
    }
  })

  return NextResponse.json({ ok: true })
}

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const { id } = await ctx.params
  const userId = Number(session.user.id)
  const accountId = await getActiveAccountId(userId)

  const existing = await prisma.journal_entry.findFirst({ where: { id, account_id: accountId } })
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 })

  await prisma.journal_entry.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
