import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { getActiveAccountId } from "@/lib/account"
import { getActiveJournalId, setActiveJournalId } from "@/lib/journal"
import { revalidatePath } from "next/cache"
import { PrismaClientKnownRequestError } from "@prisma/client/runtime/library"
import { z } from "zod"

const BodySchema = z.object({ name: z.string().min(1) })

async function getJournalId(context: unknown): Promise<string> {
  if (typeof context !== "object" || context === null) {
    throw new Error("Invalid route context")
  }
  const paramsUnknown = (context as Record<string, unknown>)["params"]
  if (typeof paramsUnknown !== "object" || paramsUnknown === null) {
    throw new Error("Route params missing")
  }
  const params =
    typeof (paramsUnknown as Promise<unknown>).then === "function"
      ? await (paramsUnknown as Promise<unknown>)
      : paramsUnknown
  if (typeof params !== "object" || params === null) {
    throw new Error("Route params missing")
  }
  const idVal = (params as Record<string, unknown>)["id"]
  if (typeof idVal === "string") return idVal
  if (Array.isArray(idVal) && typeof idVal[0] === "string") return idVal[0]
  throw new Error("Invalid route param id")
}

export async function PATCH(req: Request, context: unknown) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const userId = Number(session.user.id)
    const accountId = await getActiveAccountId(userId)
    if (!accountId) {
      return NextResponse.json({ error: "Account not found" }, { status: 404 })
    }

    const journalId = await getJournalId(context)
    const parsed = BodySchema.safeParse(await req.json())
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
    }

    const updated = await prisma.journal.updateMany({
      where: { id: journalId, account_id: accountId },
      data: { name: parsed.data.name.trim() },
    })

    if (updated.count === 0) {
      return NextResponse.json({ error: "Journal not found" }, { status: 404 })
    }

    revalidatePath("/journals")
    return NextResponse.json({ id: journalId, name: parsed.data.name.trim() })
  } catch (e: unknown) {
    if (e instanceof PrismaClientKnownRequestError && e.code === "P2002") {
      return NextResponse.json(
        { error: "A journal with this name already exists." },
        { status: 409 },
      )
    }
    console.error("[PATCH /api/journals/[id]]", e)
    return NextResponse.json({ error: "Internal error" }, { status: 500 })
  }
}

export async function DELETE(_req: Request, context: unknown) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const userId = Number(session.user.id)
    const accountId = await getActiveAccountId(userId)
    if (!accountId) {
      return NextResponse.json({ error: "Account not found" }, { status: 404 })
    }

    const journalId = await getJournalId(context)

    const journal = await prisma.journal.findFirst({
      where: { id: journalId, account_id: accountId },
      select: { id: true },
    })
    if (!journal) {
      return NextResponse.json({ error: "Journal not found" }, { status: 404 })
    }

    const activeId = await getActiveJournalId(userId)
    if (activeId === journalId) {
      await setActiveJournalId("")
    }

    const entryIds = (
      await prisma.journal_entry.findMany({
        where: { account_id: accountId, journal_id: journalId },
        select: { id: true },
      })
    ).map((e) => e.id)

    await prisma.$transaction(async (tx) => {
      if (entryIds.length) {
        await tx.futures_trade.deleteMany({
          where: { journal_entry_id: { in: entryIds } },
        })
        await tx.spot_trade.deleteMany({
          where: { journal_entry_id: { in: entryIds } },
        })
        await tx.journal_entry.deleteMany({
          where: { id: { in: entryIds } },
        })
      }
      await tx.journal.delete({ where: { id: journalId } })
    })

    revalidatePath("/journals")
    return new NextResponse(null, { status: 204 })
  } catch (e: unknown) {
    if (e instanceof PrismaClientKnownRequestError) {
      if (e.code === "P2025") {
        return NextResponse.json({ error: "Journal not found" }, { status: 404 })
      }
      if (e.code === "P2003") {
        return NextResponse.json(
          { error: "Cannot delete due to related records" },
          { status: 409 }
        )
      }
    }
    console.error("[DELETE /api/journals/[id]]", e)
    return NextResponse.json({ error: "Internal error" }, { status: 500 })
  }
}
