import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { removeCoinFromAccount } from "@/services/tracker.service"

export async function DELETE(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params
  const session = await getServerSession(authOptions)
  if (!session?.accountId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  await removeCoinFromAccount(session.accountId!, id)
  return NextResponse.json({ ok: true })
}
