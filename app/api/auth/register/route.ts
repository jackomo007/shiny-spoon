import { NextResponse } from "next/server"
import bcrypt from "bcryptjs"
import { prisma } from "@/lib/prisma"
import { cookies as nextCookies } from "next/headers"

export async function POST(req: Request) {
  try {
    const { email, username, password } = await req.json()

    const exists = await prisma.user.findUnique({ where: { email } })
    if (exists) return NextResponse.json({ error: "E-mail já está em uso" }, { status: 400 })

    const hash = await bcrypt.hash(password, 10)

    await prisma.$transaction(async (tx) => {
      const u = await tx.user.create({ data: { email, username, password_hash: hash } })
      const acc = await tx.account.create({
        data: { user_id: u.id, type: "crypto", name: "My Crypto Account" },
      })

      const jar = await nextCookies()
      jar.set("active_account_id", acc.id, {
        httpOnly: true, sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 365,
      })
    })

    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: "Failed to register" }, { status: 500 })
  }
}
