import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { addCoinToAccount, listAccountTrackers } from "@/services/tracker.service"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"

const Body = z.object({
  tvSymbol: z.string().min(3),
  displaySymbol: z.string().min(1),
  tf: z.enum(["h1","h4","d1"]),
})

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.accountId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const data = await listAccountTrackers(session.accountId)
  return NextResponse.json(data)
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.accountId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const json = await req.json()
  const p = Body.safeParse(json)
  if (!p.success) {
    return NextResponse.json({ error: p.error.flatten() }, { status: 400 })
  }

  const tracker = await addCoinToAccount({
    accountId: session.accountId!,
    tvSymbol: p.data.tvSymbol,
    displaySymbol: p.data.displaySymbol,
    tf: p.data.tf,
  })
  return NextResponse.json(tracker, { status: 201 })
}
