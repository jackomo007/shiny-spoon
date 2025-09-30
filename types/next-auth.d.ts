import "next-auth"
import "next-auth/jwt"

declare module "next-auth" {
  interface Session {
    user?: {
      id: string
      name?: string | null
      email?: string | null
      image?: string | null
      isAdmin?: boolean
    }
    accountId?: string
  }

  interface User {
    id: string
    email: string
    username: string
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    uid?: string
    userId?: number
    accountId?: string | null
    isAdmin?: boolean
    displayName?: string | null
    avatarUrl?: string | null
  }
}

export {}
