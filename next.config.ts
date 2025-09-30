import type { NextConfig } from "next"

const nextConfig: NextConfig = {
  env: {
    NEXTAUTH_URL: process.env.NEXTAUTH_URL || "http://localhost:3000",
  },

  images: {
    ...(module.exports?.images || {}),
    remotePatterns: [
      ...(module.exports?.images?.remotePatterns || []),
      { protocol: 'https', hostname: 'onpoint-tradingapp.s3.amazonaws.com' },
      { protocol: 'https', hostname: '*.amazonaws.com' },
    ],
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
    return config
  },
}

export default nextConfig
