import type { NextAuthOptions } from "next-auth"
import Credentials from "next-auth/providers/credentials"
import bcrypt from "bcryptjs"
import { prisma } from "@/lib/prisma"

async function getOrCreateDefaultAccount(userId: number) {
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
        return { id: String(user.id), email: user.email, username: user.username, name: user.username }
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
    async jwt({ token, user }) {
      type AppJWT = typeof token & {
        userId?: number
        accountId?: string | null
        isAdmin?: boolean
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

      return t
    },
    async session({ session, token }) {
      if (session.user && typeof (token as { userId?: number }).userId === "number") {
        session.user.id = (token as { userId: number }).userId.toString()
      }

      const tAcc = (token as { accountId?: string | null }).accountId
      session.accountId = typeof tAcc === "string" ? tAcc : undefined

      if (session.user) {
        const maybeIsAdmin = (token as { isAdmin?: boolean }).isAdmin
        session.user.isAdmin = !!maybeIsAdmin
      }

      return session
    },
  },
  pages: { signIn: "/login" },
}
