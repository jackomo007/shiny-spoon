import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { z } from "zod"

const Body = z.object({
  url: z.string().trim().max(2048),
})

export async function POST(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { url } = Body.parse(await req.json())
  const value = url.length > 0 ? url : null

  await prisma.user.update({
    where: { id: Number(session.user.id) },
    data: { avatar_url: value },
  })

  return NextResponse.json({ ok: true, avatarUrl: value })
}
