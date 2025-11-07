import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export const dynamic = "force-dynamic"

export async function DELETE(req: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.accountId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { pathname } = new URL(req.url)
    const segments = pathname.split("/").filter(Boolean)
    const raw = segments[segments.length - 1] || ""
    const symbol = decodeURIComponent(raw).trim().toUpperCase()
    if (!symbol) {
      return NextResponse.json({ error: "Invalid symbol" }, { status: 400 })
    }

    await prisma.$transaction(async (tx) => {
      if (symbol === "CASH") {
        const cashEntries = await tx.journal_entry.findMany({
          where: {
            account_id: session.accountId,
            asset_name: "CASH",
            spot_trade: { some: {} },
            notes_entry: { in: ["[PORTFOLIO_CASH_IN]", "[PORTFOLIO_CASH_OUT]", "[PORTFOLIO_CASH_ADJUST]"] },
          },
          select: { id: true, trade_datetime: true },
        })

        if (cashEntries.length === 0) return

        const times = cashEntries.map((e) => e.trade_datetime)

        await tx.spot_trade.deleteMany({ where: { journal_entry_id: { in: cashEntries.map((e) => e.id) } } })
        await tx.journal_entry.deleteMany({ where: { id: { in: cashEntries.map((e) => e.id) } } })

        const pairedAssetEntries = await tx.journal_entry.findMany({
          where: {
            account_id: session.accountId,
            asset_name: { not: "CASH" },
            spot_trade: { some: {} },
            trade_datetime: { in: times },
          },
          select: { id: true },
        })

        if (pairedAssetEntries.length) {
          await tx.spot_trade.deleteMany({ where: { journal_entry_id: { in: pairedAssetEntries.map((e) => e.id) } } })
          await tx.journal_entry.deleteMany({ where: { id: { in: pairedAssetEntries.map((e) => e.id) } } })
        }

        return
      }

      const symbolEntries = await tx.journal_entry.findMany({
        where: {
          account_id: session.accountId,
          asset_name: symbol,
          spot_trade: { some: {} },
        },
        select: { id: true, trade_datetime: true },
      })

      if (symbolEntries.length === 0) return

      const times = symbolEntries.map((e) => e.trade_datetime)

      await tx.spot_trade.deleteMany({ where: { journal_entry_id: { in: symbolEntries.map((e) => e.id) } } })
      await tx.journal_entry.deleteMany({ where: { id: { in: symbolEntries.map((e) => e.id) } } })

      await tx.journal_entry.deleteMany({
        where: {
          account_id: session.accountId,
          asset_name: "CASH",
          spot_trade: { some: {} },
          notes_entry: { in: ["[PORTFOLIO_CASH_IN]", "[PORTFOLIO_CASH_OUT]"] },
          trade_datetime: { in: times },
        },
      })
    })

    return new Response(null, { status: 204 })
  } catch (e) {
    return NextResponse.json({ error: "Internal error deleting asset" }, { status: 500 })
  }
}
