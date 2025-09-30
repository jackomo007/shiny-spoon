import type { NextAuthOptions } from "next-auth"
import Credentials from "next-auth/providers/credentials"
import bcrypt from "bcryptjs"
import { prisma } from "@/lib/prisma"

async function getOrCreateDefaultAccount(userId: number): Promise<string> {
  const acc =
    (await prisma.account.findFirst({ where: { user_id: userId, type: "crypto" } })) ||
    (await prisma.account.findFirst({ where: { user_id: userId } }))

  if (acc) return acc.id

  const created = await prisma.account.create({
    data: { user_id: userId, type: "crypto", name: "Default" },
    select: { id: true },
  })
  return created.id
}

const isProd = process.env.NODE_ENV === "production"

export const authOptions: NextAuthOptions = {
  session: { strategy: "jwt", maxAge: 60 * 60 * 24 * 15 },
  providers: [
    Credentials({
      name: "credentials",
      credentials: { email: { label: "Email" }, password: { label: "Password", type: "password" } },
      async authorize(creds) {
        if (!creds?.email || !creds?.password) return null
        const user = await prisma.user.findUnique({ where: { email: creds.email } })
        if (!user) return null
        const ok = await bcrypt.compare(creds.password, user.password_hash)
        if (!ok) return null
        return {
          id: String(user.id),
          email: user.email,
          username: user.username,
          name: user.username,
        }
      },
    }),
  ],
  cookies: {
    sessionToken: {
      name: isProd ? "__Secure-next-auth.session-token" : "next-auth.session-token",
      options: { httpOnly: true, sameSite: "lax", secure: isProd, path: "/" },
    },
  },
  callbacks: {
  async jwt({ token, user, trigger, session }) {
    type AppJWT = typeof token & {
      userId?: number
      accountId?: string | null
      isAdmin?: boolean
      displayName?: string | null
      avatarUrl?: string | null
    }
    const t: AppJWT = token as AppJWT

    if (user?.id) t.userId = Number(user.id)
    if (!t.accountId && t.userId) {
      t.accountId = await getOrCreateDefaultAccount(t.userId)
    }

    if (typeof t.isAdmin === "undefined") {
      const uid = typeof t.userId === "number" ? t.userId : undefined
      if (typeof uid === "number" && Number.isFinite(uid)) {
        const dbUser = await prisma.user.findUnique({
          where: { id: uid },
          select: { is_admin: true },
        })
        t.isAdmin = !!dbUser?.is_admin
      } else {
        t.isAdmin = false
      }
    }

    if (typeof t.displayName === "undefined" || typeof t.avatarUrl === "undefined") {
      if (typeof t.userId === "number") {
        const row = await prisma.user.findUnique({
          where: { id: t.userId },
          select: { display_name: true, avatar_url: true },
        })
        t.displayName = row?.display_name ?? null
        t.avatarUrl = row?.avatar_url ?? null
      } else {
        t.displayName = null
        t.avatarUrl = null
      }
    }

    if (trigger === "update" && session) {
      if (typeof session.name === "string") {
        t.displayName = session.name
      }
      const sImg = (session as { image?: string | null }).image
      if (typeof sImg !== "undefined") {
        t.avatarUrl = sImg ?? null
      }
    }

    return t
  },

  async session({ session, token }) {
    type AppJWT = typeof token & {
      userId?: number
      accountId?: string | null
      isAdmin?: boolean
      displayName?: string | null
      avatarUrl?: string | null
    }
    const t: AppJWT = token as AppJWT

    if (session.user && typeof t.userId === "number") {
      session.user.id = t.userId.toString()
    }
    session.accountId = typeof t.accountId === "string" ? t.accountId : undefined

    if (session.user) {
      session.user.isAdmin = !!t.isAdmin
      if (typeof t.displayName !== "undefined") {
        session.user.name = t.displayName
      }
      if (typeof t.avatarUrl !== "undefined") {
        session.user.image = t.avatarUrl ?? null
      }
    }

    return session
  },
},
  pages: { signIn: "/login" },
}
