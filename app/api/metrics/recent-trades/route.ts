import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import type { journal_entry_status } from "@prisma/client"

type ApiItem = {
  id: string
  asset_name: string
  trade_type: number
  status: journal_entry_status
  trade_datetime: string
}

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.accountId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const rows = await prisma.journal_entry.findMany({
    where: { account_id: session.accountId },
    orderBy: { trade_datetime: "desc" },
    select: {
      id: true,
      asset_name: true,
      status: true,
      trade_type: true,
      trade_datetime: true,
    },
    take: 5,
  })

  const items: ApiItem[] = rows.map(r => ({
    id: r.id,
    asset_name: r.asset_name,
    trade_type: r.trade_type,
    status: r.status,
    trade_datetime: r.trade_datetime.toISOString(),
  }))

  return NextResponse.json({ items })
}
