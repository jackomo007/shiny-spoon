import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { cgPriceUsdByIdSafe } from "@/lib/markets/coingecko"

export const dynamic = "force-dynamic"

export async function GET(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.accountId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const id = (searchParams.get("id") ?? "").trim()
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 })

  const result = await cgPriceUsdByIdSafe(id)

  return NextResponse.json(result, { status: 200 })
}
