import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { cookies } from "next/headers"
import { z } from "zod"

const Body = z.object({
  accountId: z.string().min(1),
})

const cookieOpts = {
  httpOnly: true as const,
  sameSite: "lax" as const,
  path: "/",
  maxAge: 60 * 60 * 24 * 365,
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  const userId = Number(session.user.id)

  let accountId: string
  try {
    const body = await req.json()
    accountId = Body.parse(body).accountId
  } catch {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 })
  }

  const owns = await prisma.account.findFirst({
    where: { id: accountId, user_id: userId },
    select: { id: true },
  })
  if (!owns) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

  const jar = await cookies()
  jar.set("active_account_id", accountId, cookieOpts)

  return NextResponse.json({ ok: true })
}
