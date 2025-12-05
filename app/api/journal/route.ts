import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { z } from "zod"
import { getActiveAccountId } from "@/lib/account"
import { getActiveJournalId } from "@/lib/journal"
import { getDefaultStrategyId, isValidAssetName, qtyFrom, calcPnl } from "@/lib/trade-helpers"

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
  source: z.enum(["portfolio"]).optional(),
  tags: z.array(z.string().min(1)).optional().default([]),
})
.superRefine((v, ctx) => {
  if (v.amount_spent == null && v.amount == null) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["amount_spent"], message: "Required" })
  }
  const t = Number(v.trade_type)
  if (t === 2 && !v.futures) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["futures"], message: "Futures data required" })
  if (t === 1 && !["buy", "sell"].includes(v.side)) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["side"], message: "Spot trades must be buy/sell" })
  if (t === 2 && !["long", "short"].includes(v.side)) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["side"], message: "Futures trades must be long/short" })
})
.transform(v => ({
  ...v,
  trade_type: Number(v.trade_type),
  amount_spent: v.amount_spent ?? v.amount!,
}))

export async function GET(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const userId = Number(session.user.id)
  const accountId = await getActiveAccountId(userId)
  if (!accountId) return NextResponse.json({ error: "Account not found" }, { status: 404 })

  const url = new URL(req.url)
  const end = url.searchParams.get("end") ? new Date(url.searchParams.get("end")!) : new Date()
  const start = url.searchParams.get("start")
    ? new Date(url.searchParams.get("start")!)
    : new Date(new Date().setMonth(end.getMonth() - 6))

  start.setHours(0, 0, 0, 0)
  end.setHours(23, 59, 59, 999)

  const journalId = await getActiveJournalId(userId)

  const rows = await prisma.journal_entry.findMany({
    where: {
      account_id: accountId,
      journal_id: journalId,
      trade_datetime: { gte: start, lte: end },
    },
    include: {
      spot_trade: true,
      futures_trade: true,
      tags: {
        include: {
          tag: true,
        },
      },
    },
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
      buyFee: Number(r.buy_fee),
      sellFee: Number(r.sell_fee),
      tradingFee: r.trading_fee != null ? Number(r.trading_fee) : null,
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
      buy_fee: Number(r.buy_fee),
      sell_fee: Number(r.sell_fee),
      trading_fee: r.trading_fee != null ? Number(r.trading_fee) : null,
      timeframe_code: r.timeframe_code,
      strategy_rule_match: r.strategy_rule_match,
      notes_entry: r.notes_entry ?? null,
      notes_review: r.notes_review ?? null,
      pnl,
      leverage,
      liquidation_price:
        r.futures_trade[0]?.liquidation_price != null
          ? Number(r.futures_trade[0].liquidation_price)
          : null,
      stop_loss_price: r.stop_loss_price != null ? Number(r.stop_loss_price) : null,
      tags: r.tags.map((jt) => jt.tag.name),
    }
  })

  return NextResponse.json({ items, range: { start, end }, journalId })
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const parsed = BaseSchema.safeParse(await req.json())
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  const data = parsed.data

  if (!(await isValidAssetName(data.asset_name))) {
    return NextResponse.json(
      { error: "Invalid asset symbol (use e.g. BTCUSDT or a verified symbol)" },
      { status: 400 },
    )
  }

  const tagNames = Array.from(
    new Set(
      (data.tags ?? [])
        .map((t) => t.trim())
        .filter(Boolean),
    ),
  )

  const userId = Number(session.user.id)
  const accountId = await getActiveAccountId(userId)
  if (!accountId) return NextResponse.json({ error: "Account not found" }, { status: 404 })

  const journalId = await getActiveJournalId(userId)
  const tradeType = data.trade_type
  const strategyId = data.strategy_id ?? (await getDefaultStrategyId(accountId))

  const okStrategy = await prisma.strategy.findFirst({
    where: { id: strategyId, account_id: accountId },
    select: { id: true },
  })
  if (!okStrategy) return NextResponse.json({ error: "Strategy not found" }, { status: 404 })

  const statusToPersist: Status = data.status as Status
  const exitToPersist = data.exit_price ?? null
  const sellFeeToPersist = data.sell_fee ?? 0

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
        asset_name: data.asset_name.toUpperCase(),
        trade_datetime: new Date(data.trade_datetime),
        side: data.side,
        status: statusToPersist,
        amount_spent: data.amount_spent,
        amount: amountQty,
        strategy_id: strategyId,
        notes_entry:
          data.source === "portfolio" ? `[JE:PORTFOLIO]` : data.notes_entry ?? null,
        notes_review: data.notes_review ?? null,
        timeframe_code: data.timeframe_code,
        buy_fee: Number(data.buy_fee ?? 0),
        sell_fee: Number(sellFeeToPersist),
        trading_fee: Number(data.trading_fee ?? 0),
        strategy_rule_match: data.strategy_rule_match ?? 0,
        entry_price: data.entry_price,
        exit_price: exitToPersist,
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
        data: {
          journal_entry_id: je.id,
          leverage: f.leverage,
          liquidation_price: f.liquidation_price,
          margin_used: marginUsed,
        },
      })
    }

    if (tagNames.length) {
      const existingTags = await tx.tag.findMany({
        where: {
          account_id: accountId,
          name: { in: tagNames },
        },
      })

      const existingByName = new Map(existingTags.map((t) => [t.name, t]))
      const missingNames = tagNames.filter((name) => !existingByName.has(name))

      if (missingNames.length) {
        await tx.tag.createMany({
          data: missingNames.map((name) => ({
            name,
            account_id: accountId,
          })),
          skipDuplicates: true,
        })
      }

      const allTags = await tx.tag.findMany({
        where: {
          account_id: accountId,
          name: { in: tagNames },
        },
        select: { id: true },
      })

      await tx.journal_entry_tag.createMany({
        data: allTags.map((t) => ({
          journal_entry_id: je.id,
          tag_id: t.id,
        })),
        skipDuplicates: true,
      })
    }

    if (data.source === "portfolio") {
      const when = new Date(data.trade_datetime)
      const price = Number(data.entry_price)
      const qty = amountQty
      const fee =
        Number(data.buy_fee ?? 0) +
        Number(data.sell_fee ?? 0) +
        Number(data.trading_fee ?? 0)

      let kind: "buy" | "sell" | "cash_in" | "cash_out" | "init" = "buy"
      if (data.asset_name.toUpperCase() === "CASH") {
        kind = data.side === "buy" ? "cash_in" : "cash_out"
      } else {
        kind = data.side === "sell" ? "sell" : "buy"
      }

      const cashDelta =
        kind === "sell"
          ? price * qty - fee
          : kind === "buy"
          ? -(price * qty + fee)
          : kind === "cash_in"
          ? Number(data.amount_spent)
          : kind === "cash_out"
          ? -Number(data.amount_spent)
          : 0

      await tx.portfolio_trade.create({
        data: {
          account_id: accountId,
          trade_datetime: when,
          asset_name: data.asset_name.toUpperCase(),
          kind,
          qty,
          price_usd: price,
          fee_usd: fee,
          cash_delta_usd: cashDelta,
          note: `[JE:${je.id}]`,
        },
      })
    }

    return je
  })

  return NextResponse.json({ id: created.id })
}
