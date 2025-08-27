export const runtime = "nodejs"

import Credentials from "next-auth/providers/credentials"
import type { NextAuthOptions } from "next-auth"
import { compare } from "bcryptjs"
import { prisma } from "@/lib/prisma"

export const authOptions: NextAuthOptions = {
  session: { strategy: "jwt" },
  pages: {
    signIn: "/login",
  },
  providers: [
    Credentials({
      name: "Credentials",
      credentials: { email: {}, password: {} },
      async authorize(creds) {
        if (!creds?.email || !creds?.password) return null
        const user = await prisma.user.findUnique({ where: { email: creds.email } })
        if (!user) return null
        const ok = await compare(creds.password, user.password_hash)
        if (!ok) return null
        return { id: String(user.id), name: user.username, email: user.email }
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user?.id) token.id = String(user.id)
      return token
    },
    async session({ session, token }: { session: import("next-auth").Session, token: { id?: string, sub?: string } }) {
      if (session.user && token) {
        session.user.id = token.id ?? token.sub ?? ""
      }
      // Ensure the session object includes the required 'expires' property
      return {
        ...session,
        expires: session.expires ?? new Date(Date.now() + 1000 * 60 * 60 * 24 * 30).toISOString(), // fallback: 30 days
      }
    },
  },
}
