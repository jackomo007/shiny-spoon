import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.isAdmin) return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  const users = await prisma.user.findMany({
    orderBy: { created_at: "desc" },
    select: { id: true, email: true, username: true, is_admin: true, created_at: true },
  })
  return NextResponse.json({ items: users })
}
