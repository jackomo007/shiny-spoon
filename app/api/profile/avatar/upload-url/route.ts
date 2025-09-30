import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { z } from "zod"
import { getAvatarPutUrl } from "@/lib/s3"

const Q = z.object({ contentType: z.string().min(1).max(100) })

export async function GET(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const parsed = Q.safeParse({ contentType: searchParams.get("contentType") ?? "" })
  if (!parsed.success) return NextResponse.json({ error: "Invalid contentType" }, { status: 400 })

  const { url, publicUrl } = await getAvatarPutUrl(Number(session.user.id), parsed.data.contentType)
  return NextResponse.json({ url, publicUrl })
}
