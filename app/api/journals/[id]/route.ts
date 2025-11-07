import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { getActiveAccountId } from "@/lib/account"
import { getActiveJournalId, setActiveJournalId } from "@/lib/journal"
import { revalidatePath } from "next/cache"
import { PrismaClientKnownRequestError } from "@prisma/client/runtime/library"

function getJournalId(context: unknown): string {
  if (typeof context !== "object" || context === null) {
    throw new Error("Invalid route context")
  }
  const paramsUnknown = (context as Record<string, unknown>)["params"]
  if (typeof paramsUnknown !== "object" || paramsUnknown === null) {
    throw new Error("Route params missing")
  }
  const idVal = (paramsUnknown as Record<string, unknown>)["id"]
  if (typeof idVal === "string") return idVal
  if (Array.isArray(idVal) && typeof idVal[0] === "string") return idVal[0]
  throw new Error("Invalid route param id")
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

    const journalId = getJournalId(context)

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
        await tx.portfolio_trade.deleteMany({
          where: {
            account_id: accountId,
            note: { in: entryIds.map((id) => `[JE:${id}]`) },
          },
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
