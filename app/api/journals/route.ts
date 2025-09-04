import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { z } from "zod"
// ...demais imports

const BodySchema = z.object({ name: z.string().min(1) })

export async function POST(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const userId = Number(session.user.id)

  // ✅ aceitar JSON ou form-data do <form>
  const ct = req.headers.get("content-type") ?? ""
  const raw = ct.includes("application/json")
    ? await req.json()
    : Object.fromEntries((await req.formData()).entries())

  const parsed = BodySchema.safeParse(raw)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  // pegue o account ativo como você já faz (se precisar)
  // const accountId = await getActiveAccountId(userId)

  const created = await prisma.journal.create({
    data: {
      // account_id: accountId,  // se o schema exigir, inclua
      name: parsed.data.name.trim(),
      account_id: await (async () => {
        // se você já tem util para isso, use; se não, injete o id correto
        const { getActiveAccountId } = await import("@/lib/account")
        const accId = await getActiveAccountId(userId)
        if (!accId) throw new Error("Active account not found")
        return accId
      })(),
    },
    select: { id: true },
  })

  return NextResponse.json({ id: created.id })
}
