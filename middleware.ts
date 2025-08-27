import { withAuth } from "next-auth/middleware"

export default withAuth({
  pages: { signIn: "/login" },
})

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/strategies/:path*",
    "/journal/:path*",
    "/market-analysis/:path*",
  ],
}
