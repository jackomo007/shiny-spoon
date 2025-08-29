import { cookies } from "next/headers"
import { prisma } from "@/lib/prisma"

export async function getActiveAccountId(userId: number): Promise<string | null> {
  const jar = await cookies()
  const fromCookie = jar.get("active_account_id")?.value

  if (fromCookie) {
    const ok = await prisma.account.findFirst({
      where: { id: fromCookie, user_id: userId },
      select: { id: true },
    })
    if (ok) return ok.id
  }

  const first = await prisma.account.findFirst({
    where: { user_id: userId },
    orderBy: { created_at: "asc" },
    select: { id: true },
  })
  return first?.id ?? null
}

export async function listAccountsWithActive(userId: number) {
  const jar = await cookies()
  const active = jar.get("active_account_id")?.value ?? null

  const rows = await prisma.account.findMany({
    where: { user_id: userId },
    orderBy: { created_at: "asc" },
    select: { id: true, name: true, type: true, created_at: true },
  })

  return {
    active,
    items: rows,
  }
}
