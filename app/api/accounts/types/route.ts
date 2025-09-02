import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { cookies } from "next/headers"
import { z } from "zod"

const T = z.enum(["crypto", "stock", "forex"])
const cookieOpts = { httpOnly: true as const, sameSite: "lax" as const, path: "/", maxAge: 60 * 60 * 24 * 365 }

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const userId = Number(session.user.id)

  const items = await prisma.account.findMany({
    where: { user_id: userId },
    orderBy: { created_at: "asc" },
    select: { id: true, type: true, name: true },
  })
  return NextResponse.json({ items, types: items.map(i => i.type) })
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const userId = Number(session.user.id)
  const { type } = z.object({ type: T }).parse(await req.json())

  const exists = await prisma.account.findFirst({ where: { user_id: userId, type } })
  if (exists) return NextResponse.json({ id: exists.id, existed: true })

  const created = await prisma.account.create({
    data: { user_id: userId, type, name: `My ${type[0].toUpperCase() + type.slice(1)} Account` },
    select: { id: true, type: true },
  })

  const jar = await cookies()
  const active = jar.get("active_account_id")?.value
  if (!active || created.type === "crypto") {
    jar.set("active_account_id", created.id, cookieOpts)
  }

  return NextResponse.json({ id: created.id })
}

export async function DELETE(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const userId = Number(session.user.id)
  const { type } = z.object({ type: T }).parse(await req.json())

  if (type === "crypto") return NextResponse.json({ error: "Cannot delete crypto account" }, { status: 400 })

  const acc = await prisma.account.findFirst({
    where: { user_id: userId, type },
    select: { id: true },
  })
  if (!acc) return NextResponse.json({ ok: true })

  await prisma.account.delete({ where: { id: acc.id } })

  const jar = await cookies()
  const active = jar.get("active_account_id")?.value
  if (active === acc.id) {
    const fallback =
      (await prisma.account.findFirst({
        where: { user_id: userId, type: "crypto" },
        select: { id: true },
      })) ||
      (await prisma.account.findFirst({
        where: { user_id: userId },
        orderBy: [{ type: "asc" }, { created_at: "asc" }],
        select: { id: true },
      }))

    if (fallback) {
      jar.set("active_account_id", fallback.id, cookieOpts)
    } else {
      const recreated = await prisma.account.create({
        data: { user_id: userId, type: "crypto", name: "My Crypto Account" },
        select: { id: true },
      })
      jar.set("active_account_id", recreated.id, cookieOpts)
    }
  }

  return NextResponse.json({ ok: true })
}
