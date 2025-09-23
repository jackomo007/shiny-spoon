import type { NextConfig } from "next"

const nextConfig: NextConfig = {
  env: {
    NEXTAUTH_URL: process.env.NEXTAUTH_URL || "http://localhost:3000",
    TRADINGVIEW_BASE:
      process.env.TRADINGVIEW_BASE || "https://www.tradingview.com/chart",
  },

  images: {
    remotePatterns: [{ protocol: "https", hostname: "**.amazonaws.com" }],
  },

  experimental: {
    serverComponentsExternalPackages: ["@napi-rs/canvas"],
  },

  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.resolve.alias = {
        ...(config.resolve.alias || {}),
        "@napi-rs/canvas": false,
      }
    }

    if (isServer) {
      const externals = config.externals || []
      externals.push("@napi-rs/canvas")
      config.externals = externals
    }

    return config
  },
}

export default nextConfig
