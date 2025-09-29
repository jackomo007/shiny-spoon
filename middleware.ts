import { withAuth } from "next-auth/middleware"
import type { NextRequest } from "next/server"
import { NextResponse } from "next/server"
import type { JWT } from "next-auth/jwt"

const RATE_LIMITED_POST = ["/api/journal", "/api/strategies", "/api/billing"]

const buckets = new Map<string, { count: number; resetAt: number }>()
const WINDOW_MS = 15_000
const LIMIT = 20

function rateLimit(key: string) {
  const now = Date.now()
  const b = buckets.get(key)
  if (!b || now > b.resetAt) {
    buckets.set(key, { count: 1, resetAt: now + WINDOW_MS })
    return true
  }
  if (b.count < LIMIT) {
    b.count += 1
    return true
  }
  return false
}

function getClientIp(req: NextRequest): string {
  const xf = req.headers.get("x-forwarded-for")
  if (xf) {
    const first = xf.split(",")[0]?.trim()
    if (first) return first
  }
  const real = req.headers.get("x-real-ip")
  if (real) return real
  const cf = req.headers.get("cf-connecting-ip")
  if (cf) return cf
  return "unknown"
}

export default withAuth(
  async function middleware(req: NextRequest) {
    const { pathname } = req.nextUrl

    if (
      pathname.startsWith("/api/") &&
      !["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"].includes(req.method.toUpperCase())
    ) {
      return NextResponse.json({ error: "Method Not Allowed" }, { status: 405 })
    }

    if (req.method === "POST" && RATE_LIMITED_POST.some((p) => pathname.startsWith(p))) {
      const ip = getClientIp(req)
      const key = `post:${pathname}:${ip}`
      if (!rateLimit(key)) {
        return NextResponse.json({ error: "Too Many Requests" }, { status: 429 })
      }
    }

    return NextResponse.next()
  },
  {
    pages: { signIn: "/login" },
    callbacks: {
      authorized: ({ req, token }) => {
        const pathname = (req as NextRequest).nextUrl.pathname

        if (pathname.startsWith("/api/tracker/run")) {
          const key = (req as NextRequest).headers.get("x-cron-key")
          const devKey =
            process.env.NODE_ENV !== "production" ? process.env.NEXT_PUBLIC_DEV_CRON_SECRET : undefined
          const ok = key && (key === process.env.CRON_SECRET || key === devKey)
          return !!ok
        }

        if (pathname.startsWith("/admin") || pathname.startsWith("/api/admin")) {
          const t = token as JWT | null
          return !!t && !!t.isAdmin
        }

        if (pathname.startsWith("/api/tracker")) return !!token

        return !!token
      },
    },
  }
)

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/strategies/:path*",
    "/journal/:path*",
    "/chart-tracker/:path*",
    "/profile/:path*",
    "/admin/:path*",
    "/api/admin/:path*",
    "/api/journal/:path*",
    "/api/strategies/:path*",
    "/api/billing/:path*",
    "/api/tracker/:path*",
  ],
}
