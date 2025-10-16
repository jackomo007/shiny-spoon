import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export const dynamic = "force-dynamic"

type JournalRow = {
  id: string
  trade_datetime: Date
  asset_name: string
  side: "buy" | "sell" | "long" | "short"
  entry_price: number | null
  buy_fee: number | null
  sell_fee: number | null
  amount_spent: number | null
  amount: number | null
  notes_entry: string | null
}

type HistoryItem = {
  id: string
  when: string
  asset: string
  kind: "buy" | "sell" | "cash_in" | "cash_out" | "init"
  qty: number
  priceUsd: number
  feeUsd: number
  cashDeltaUsd: number
  note: string | null
}

export async function GET(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.accountId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const url = new URL(req.url)
  const limitRaw = url.searchParams.get("limit")
  const parsedLimit = Number(limitRaw ?? 200)
  const limit = Number.isFinite(parsedLimit)
    ? Math.min(Math.max(parsedLimit, 1), 1000)
    : 200

  const rows = await prisma.journal_entry.findMany({
    where: { account_id: session.accountId },
    orderBy: { trade_datetime: "desc" },
    take: limit,
    select: {
      id: true,
      trade_datetime: true,
      asset_name: true,
      side: true,
      entry_price: true,
      buy_fee: true,
      sell_fee: true,
      amount_spent: true,
      amount: true,
      notes_entry: true,
    },
  })

  const casted: JournalRow[] = rows.map((r) => ({
    id: r.id,
    trade_datetime: r.trade_datetime as Date,
    asset_name: r.asset_name as string,
    side: r.side as "buy" | "sell" | "long" | "short",
    entry_price: (r.entry_price as unknown as number | null) ?? null,
    buy_fee: (r.buy_fee as unknown as number | null) ?? null,
    sell_fee: (r.sell_fee as unknown as number | null) ?? null,
    amount_spent: (r.amount_spent as unknown as number | null) ?? null,
    amount: (r.amount as unknown as number | null) ?? null,
    notes_entry: (r.notes_entry as string | null) ?? null,
  }))

  const items: HistoryItem[] = casted.map((r) => {
    let kind: HistoryItem["kind"] =
      r.asset_name === "CASH"
        ? (r.side === "buy" ? "cash_in" : "cash_out")
        : (r.side === "buy" ? "buy" : "sell")

    if (r.notes_entry === "[PORTFOLIO_ADD]") {
      kind = "init"
    }

    const price = Number(r.entry_price ?? 0)
    const qty = Number(r.amount ?? 0)
    const fee = Number(r.buy_fee ?? 0) + Number(r.sell_fee ?? 0)

    const cashDelta =
      r.asset_name === "CASH"
        ? (r.side === "buy" ? 1 : -1) * Number(r.amount_spent ?? 0)
        : kind === "sell"
          ? price * qty - fee
          : (kind === "buy" || kind === "init")
            ? -(price * qty + fee)
            : 0

    return {
      id: r.id,
      when: r.trade_datetime.toISOString(),
      asset: r.asset_name,
      kind,
      qty,
      priceUsd: price,
      feeUsd: fee,
      cashDeltaUsd: cashDelta,
      note: r.notes_entry,
    }
  })

  return NextResponse.json({ items })
}
