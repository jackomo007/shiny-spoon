import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { Prisma } from "@prisma/client"
import { z } from "zod"
import { getActiveAccountId } from "@/lib/account"
import { getActiveJournalId } from "@/lib/journal"
import { setActiveJournalId } from "@/lib/journal" 

const BodySchema = z.object({ name: z.string().min(1) })

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const userId = Number(session.user.id)
  const accountId = await getActiveAccountId(userId)
  if (!accountId) {
    return NextResponse.json({ error: "Account not found" }, { status: 404 })
  }

  const items = await prisma.journal.findMany({
    where: { account_id: accountId },
    orderBy: { created_at: "asc" },
    select: { id: true, name: true, created_at: true },
  })

  const activeJournalId = await getActiveJournalId(userId)

  return NextResponse.json({ items, activeJournalId })
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  const userId = Number(session.user.id)

  const ct = req.headers.get("content-type") ?? ""
  const raw =
    ct.includes("application/json")
      ? await req.json()
      : Object.fromEntries((await req.formData()).entries())

  const parsed = BodySchema.safeParse(raw)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const accountId = await getActiveAccountId(userId)
  if (!accountId) {
    return NextResponse.json({ error: "Active account not found" }, { status: 404 })
  }

  try {
    const countBefore = await prisma.journal.count({ where: { account_id: accountId } })

    const created = await prisma.journal.create({
      data: { name: parsed.data.name.trim(), account_id: accountId },
      select: { id: true },
    })

    if (countBefore === 0) {
      await setActiveJournalId(created.id)
    }

    return NextResponse.json({ id: created.id })
  } catch (err: unknown) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      return NextResponse.json({ error: "A journal with this name already exists." }, { status: 409 })
    }
    return NextResponse.json({ error: "Failed to create" }, { status: 500 })
  }
}
