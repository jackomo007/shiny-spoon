import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { z } from "zod"
import { getActiveAccountId } from "@/lib/account"
import { Prisma } from "@prisma/client"

export async function DELETE(_req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await context.params
  const userId = Number(session.user.id)
  const accountId = await getActiveAccountId(userId)
  if (!accountId) return NextResponse.json({ error: "Active account not found" }, { status: 404 })

  const exists = await prisma.journal.findFirst({ where: { id, account_id: accountId }, select: { id: true } })
  if (!exists) return NextResponse.json({ error: "Not found" }, { status: 404 })

  await prisma.journal.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}

const RenameBody = z.object({ name: z.string().min(1) })

export async function PATCH(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await context.params
  const userId = Number(session.user.id)
  const accountId = await getActiveAccountId(userId)
  if (!accountId) return NextResponse.json({ error: "Active account not found" }, { status: 404 })

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  const parsed = RenameBody.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const exists = await prisma.journal.findFirst({
    where: { id, account_id: accountId },
    select: { id: true },
  })
  if (!exists) return NextResponse.json({ error: "Journal not found" }, { status: 404 })

  try {
    await prisma.journal.update({
      where: { id },
      data: { name: parsed.data.name.trim() },
    })
    return NextResponse.json({ ok: true })
  } catch (err: unknown) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      return NextResponse.json({ error: "A journal with this name already exists." }, { status: 409 })
    }
    return NextResponse.json({ error: "Failed to rename" }, { status: 500 })
  }
}
