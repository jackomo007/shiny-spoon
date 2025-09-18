import type { NextConfig } from "next"

const nextConfig: NextConfig = {
  env: {
    NEXTAUTH_URL: process.env.NEXTAUTH_URL || "http://localhost:3000",
    TRADINGVIEW_BASE: process.env.TRADINGVIEW_BASE || "https://www.tradingview.com/chart",
  },

  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**.amazonaws.com",
      },
    ],
  },
}

export default nextConfig
