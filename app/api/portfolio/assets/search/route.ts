import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { cgSearch } from "@/lib/markets/coingecko"

export const dynamic = "force-dynamic"

export async function GET(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.accountId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const q = (searchParams.get("q") ?? "").trim()
  if (!q) return NextResponse.json({ items: [] })

  const items = await cgSearch(q)
  return NextResponse.json({
    items: items.map((c) => ({
      id: c.id,
      symbol: c.symbol?.toUpperCase(),
      name: c.name,
      thumb: c.thumb ?? null,
    })),
  })
}
