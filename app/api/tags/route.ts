import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { getActiveAccountId } from "@/lib/account"
import { z } from "zod"
import { Prisma } from "@prisma/client"

const BodySchema = z.object({
  name: z.string().min(1),
})

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

  const items = await prisma.tag.findMany({
    where: { account_id: accountId },
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  })

  return NextResponse.json({ items })
}

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

  const parsed = BodySchema.safeParse(await req.json())
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const name = parsed.data.name.trim()
  if (!name) {
    return NextResponse.json({ error: "Name is required" }, { status: 400 })
  }

  try {
    const created = await prisma.tag.create({
      data: {
        name,
        account_id: accountId,
      },
      select: { id: true, name: true },
    })

    return NextResponse.json(created, { status: 201 })
  } catch (err: unknown) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      const existing = await prisma.tag.findFirst({
        where: { account_id: accountId, name },
        select: { id: true, name: true },
      })
      if (existing) {
        return NextResponse.json(existing, { status: 200 })
      }
    }
    return NextResponse.json({ error: "Failed to create tag" }, { status: 500 })
  }
}
