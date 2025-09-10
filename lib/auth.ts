import type { NextAuthOptions } from "next-auth"
import Credentials from "next-auth/providers/credentials"
import bcrypt from "bcryptjs"
import { prisma } from "@/lib/prisma"

const isProd = process.env.NODE_ENV === "production"

export const authOptions: NextAuthOptions = {
  session: {
    strategy: "jwt",
    maxAge: 60 * 60 * 24 * 15,
  },
  providers: [
    Credentials({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "text" },
        password: { label: "Password", type: "password" },
      },
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
      options: {
        httpOnly: true,
        sameSite: "lax",
        secure: isProd,
        path: "/",
      },
    },
  },

  callbacks: {
    async jwt({ token, user }) {
      if (user?.id) token.userId = Number(user.id)
      return token
    },
    async session({ session, token }) {
      if (token?.userId) session.user.id = token.userId.toString()
      return session
    },
  },

  pages: {
    signIn: "/login",
  },
}
