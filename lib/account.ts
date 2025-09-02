import { prisma } from "@/lib/prisma"
import { cookies } from "next/headers"
const COOKIE_NAME = "active_account_id"
const cookieOpts = {
  httpOnly: true as const,
  sameSite: "lax" as const,
  path: "/",
  maxAge: 60 * 60 * 24 * 365,
}

export async function getActiveAccountId(userId: number): Promise<string> {
  const jar = await cookies()
  const fromCookie = jar.get(COOKIE_NAME)?.value ?? null

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
  if (!first) throw new Error("User has no accounts")

  jar.set(COOKIE_NAME, first.id, cookieOpts)
  return first.id
}

export async function listAccountsWithActive(userId: number) {
  const jar = await cookies()
  const activeId = jar.get(COOKIE_NAME)?.value ?? null

  const rows = await prisma.account.findMany({
    where: { user_id: userId },
    orderBy: { created_at: "asc" },
    select: { id: true, name: true, type: true, created_at: true },
  })

  return { items: rows, activeId }
}

export async function setActiveAccountId(
  userId: number,
  accountId: string
): Promise<boolean> {
  const ok = await prisma.account.findFirst({
    where: { id: accountId, user_id: userId },
    select: { id: true },
  })
  if (!ok) return false
  const jar = await cookies()
  jar.set(COOKIE_NAME, accountId, cookieOpts)
  return true
}

export async function selectAccount(userId: number, accountId: string) {
  const acc = await prisma.account.findFirst({
    where: { id: accountId, user_id: userId },
    select: { id: true },
  })
  if (!acc) return false

  const jar = await cookies()
  jar.set(COOKIE_NAME, acc.id, cookieOpts)
  return true
}
