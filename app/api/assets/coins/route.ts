import { NextResponse } from "next/server"
import { z } from "zod"

const Q = z.object({ q: z.string().trim().min(1) })

export async function GET(req: Request) {
  const url = new URL(req.url)
  const parsed = Q.safeParse({ q: url.searchParams.get("q") ?? "" })
  if (!parsed.success) {
    return NextResponse.json({ items: [] })
  }

  const key = process.env.CMC_API_KEY
  if (!key) {
    return NextResponse.json({ items: [] })
  }

  const resp = await fetch(
    `https://pro-api.coinmarketcap.com/v1/cryptocurrency/map?listing_status=active&limit=50&symbol=${encodeURIComponent(parsed.data.q)}`,
    { headers: { "X-CMC_PRO_API_KEY": key }, cache: "no-store" }
  )

  if (!resp.ok) return NextResponse.json({ items: [] }, { status: 200 })

  const data = (await resp.json()) as {
    data?: Array<{ id: number; name: string; symbol: string }>
  }

  const items = (data.data ?? []).map(d => ({
    id: String(d.id),
    symbol: d.symbol,
    name: d.name,
  }))

  return NextResponse.json({ items })
}
