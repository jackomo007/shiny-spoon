import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { z } from "zod"

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.isAdmin) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const { id } = await params
  const uid = Number(id)
  const body = await req.json().catch(() => ({}))
  const parsed = z.object({ confirm: z.string().min(1) }).safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const user = await prisma.user.findUnique({ where: { id: uid }, select: { email: true, username: true } })
  if (!user) return NextResponse.json({ error: "Not found" }, { status: 404 })

  const label = user.username || user.email
  if (parsed.data.confirm !== label) {
    return NextResponse.json({ error: `Type the username/email exactly: ${label}` }, { status: 400 })
  }

  await prisma.$transaction(async (tx) => {
    const accounts = await tx.account.findMany({ where: { user_id: uid }, select: { id: true } })
    const accIds = accounts.map(a => a.id)
    await tx.chart_subscription.deleteMany({ where: { account_id: { in: accIds } } })
    await tx.journal_entry.deleteMany({ where: { account_id: { in: accIds } } })
    await tx.journal.deleteMany({ where: { account_id: { in: accIds } } })
    await tx.strategy_rule.deleteMany({ where: { strategy: { account_id: { in: accIds } } } })
    await tx.strategy.deleteMany({ where: { account_id: { in: accIds } } })
    await tx.account.deleteMany({ where: { user_id: uid } })
    await tx.user.delete({ where: { id: uid } })
  })

  return NextResponse.json({ ok: true })
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const { id } = await params
  const uid = Number(id)

  const parsed = z.object({ is_admin: z.boolean() }).safeParse(await req.json().catch(() => ({})))
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  if (String(session.user.id) === String(uid) && parsed.data.is_admin === false) {
    const countAdmins = await prisma.user.count({ where: { is_admin: true } })
    if (countAdmins <= 1) {
      return NextResponse.json({ error: "Cannot remove the last admin." }, { status: 400 })
    }
  }

  const updated = await prisma.user.update({
    where: { id: uid },
    data: { is_admin: parsed.data.is_admin },
    select: { id: true, email: true, username: true, is_admin: true, created_at: true },
  })

  return NextResponse.json({ item: updated })
}
