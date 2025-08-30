import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { listAccountsWithActive } from "@/lib/account"

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const userId = Number(session.user.id)
  const { items, active } = await listAccountsWithActive(userId)
  return NextResponse.json({ accounts: items, active })
}
