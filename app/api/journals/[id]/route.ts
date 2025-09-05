import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { getActiveAccountId } from "@/lib/account"

export async function DELETE(_req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await context.params

  const userId = Number(session.user.id)
  const accountId = await getActiveAccountId(userId)
  if (!accountId) return NextResponse.json({ error: "Active account not found" }, { status: 404 })

  const exists = await prisma.journal.findFirst({
    where: { id, account_id: accountId },
    select: { id: true },
  })
  if (!exists) return NextResponse.json({ error: "Not found" }, { status: 404 })

  await prisma.journal.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
