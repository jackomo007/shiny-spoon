import { NextResponse } from "next/server"
import { z } from "zod"

const Q = z.object({ q: z.string().trim().min(1) })

export async function GET(req: Request) {
  const url = new URL(req.url)
  const { q } = Q.parse({ q: url.searchParams.get("q") ?? "" })
  const key = process.env.CMC_API_KEY
  if (!key) return NextResponse.json({ error: "Missing CMC_API_KEY" }, { status: 500 })

  // Use /v1/cryptocurrency/map as a lightweight matcher
  const resp = await fetch(`https://pro-api.coinmarketcap.com/v1/cryptocurrency/map?listing_status=active&limit=50&symbol=${encodeURIComponent(q)}`, {
    headers: { "X-CMC_PRO_API_KEY": key },
    cache: "no-store",
  })
  if (!resp.ok) return NextResponse.json({ error: "CMC error" }, { status: 502 })
  const data = (await resp.json()) as { data?: Array<{ id: number; name: string; symbol: string }> }

  const items = (data.data ?? []).map(d => ({ id: String(d.id), name: d.name, symbol: d.symbol }))
  return NextResponse.json({ items })
}
