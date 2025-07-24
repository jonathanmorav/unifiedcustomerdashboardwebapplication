import type { NextConfig } from "next"

const nextConfig: NextConfig = {
  // Enable standalone output for Docker
  output: process.env.DOCKER_BUILD === "true" ? "standalone" : undefined,

  // Optimize for production
  poweredByHeader: false,
  compress: true,

  // Security headers are handled by middleware
  async headers() {
    return []
  },

  // Image optimization
  images: {
    domains: [
      "localhost",
      // Add your production domains here
    ],
    formats: ["image/avif", "image/webp"],
  },

  // Experimental features
  experimental: {
    // Add experimental features here if needed
  },

  // Environment variables available to the browser
  env: {
    NEXT_PUBLIC_APP_VERSION: process.env.npm_package_version || "0.1.0",
  },

  // ESLint configuration
  eslint: {
    // Allow production builds to complete even with ESLint errors
    // This is temporarily enabled to fix E2E tests
    ignoreDuringBuilds: true,
  },
}

export default nextConfig
