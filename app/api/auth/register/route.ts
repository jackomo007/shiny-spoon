export const runtime = "nodejs"

import { prisma } from "@/lib/prisma"
import { hash } from "bcryptjs"
import { z } from "zod"
import { NextResponse } from "next/server"

const RegisterSchema = z.object({
  email: z.string().email(),
  username: z.string().min(2),
  password: z.string().min(6),
})

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const parsed = RegisterSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid payload", details: parsed.error.format() }, { status: 400 })
    }

    const { email, username, password } = parsed.data

    const emailExists = await prisma.user.findUnique({ where: { email } })
    if (emailExists) {
      return NextResponse.json({ error: "Email already in use" }, { status: 409 })
    }

    const usernameExists = await prisma.user.findFirst({
      where: { username },
    })
    if (usernameExists) {
      return NextResponse.json({ error: "Username already in use" }, { status: 409 })
    }

    const password_hash = await hash(password, 10)
    await prisma.user.create({
      data: { email, username, password_hash },
    })

    return NextResponse.json({ ok: true }, { status: 201 })
  } catch (e: unknown) {
    console.error(e)
    const errorMessage = typeof e === "object" && e !== null && "message" in e
      ? (e as { message?: string }).message
      : "Internal error";
    return NextResponse.json({ error: errorMessage ?? "Internal error" }, { status: 500 })
  }
}
