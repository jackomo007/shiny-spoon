import "next-auth"
import "next-auth/jwt"

declare module "next-auth" {
  interface Session {
    user: {
      id: string
      name?: string | null
      email?: string | null
      image?: string | null
    }
    accountId?: string | null
  }

  interface User {
    id: string
    email: string
    username: string
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    uid: string
    accountId?: string | null
  }
}

export {}
