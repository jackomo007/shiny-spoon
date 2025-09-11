import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { getActiveAccountId } from "@/lib/account"
import { setActiveJournalId } from "@/lib/journal"
import { z } from "zod"

const BodySchema = z.object({
  id: z.string().min(1).optional(),
  journal_id: z.string().min(1).optional(),
}).refine(v => v.id || v.journal_id, { message: "Missing id" })

export async function POST(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  const userId = Number(session.user.id)

  const accountId = await getActiveAccountId(userId)
  if (!accountId) {
    return NextResponse.json({ error: "Account not found" }, { status: 404 })
  }

  let bodyUnknown: unknown
  try {
    bodyUnknown = await req.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }
  const parsed = BodySchema.safeParse(bodyUnknown)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const targetId = parsed.data.id ?? parsed.data.journal_id!

  const exists = await prisma.journal.findFirst({
    where: { id: targetId, account_id: accountId },
    select: { id: true },
  })
  if (!exists) {
    return NextResponse.json({ error: "Journal not found" }, { status: 404 })
  }

  await setActiveJournalId(targetId)

  return NextResponse.json({ ok: true })
}
