import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { z } from "zod"

const Body = z.object({ displayName: z.string().trim().min(2).max(100) })

export async function POST(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const { displayName } = Body.parse(await req.json())

  await prisma.user.update({
    where: { id: Number(session.user.id) },
    data: { display_name: displayName },
  })

  return NextResponse.json({ ok: true, displayName })
}
