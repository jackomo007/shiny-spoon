import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { selectAccount } from "@/lib/account"

export async function POST(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { accountId } = await req.json()
  const userId = Number(session.user.id)
  const ok = await selectAccount(userId, accountId)
  if (!ok) return NextResponse.json({ error: "Account not found" }, { status: 404 })

  return NextResponse.json({ ok: true })
}
