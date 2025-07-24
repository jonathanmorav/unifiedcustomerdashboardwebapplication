import { NextRequest, NextResponse } from "next/server"
import { getToken } from "next-auth/jwt"
import {
  rateLimiter,
  rateLimitConfigs,
  logRateLimitViolation,
  detectAbusePattern,
} from "@/lib/security/rate-limit"
import { getEnv } from "@/lib/env"

export async function rateLimitMiddleware(request: NextRequest) {
  const path = request.nextUrl.pathname
  const env = getEnv()

  // Determine which rate limit config to use
  let configName: keyof typeof rateLimitConfigs = "global"
  let config = { ...rateLimitConfigs.global }

  if (path.startsWith("/api/auth")) {
    configName = "auth"
    config = { ...rateLimitConfigs.auth }
  } else if (path.startsWith("/api/search")) {
    configName = "search"
    config = { ...rateLimitConfigs.search }
  } else if (path.startsWith("/api/")) {
    configName = "api"
    config = { ...rateLimitConfigs.api }
  }

  // Override with environment variable if set
  if (configName === "global") {
    config.max = env.RATE_LIMIT_REQUESTS_PER_MINUTE
  }

  // Get user info for better rate limiting
  const token = await getToken({
    req: request as any,
    secret: env.NEXTAUTH_SECRET,
  })

  // Create key generator that uses user ID if available
  const keyGenerator = (req: NextRequest) => {
    if (token?.id) {
      return `user:${token.id}`
    }

    const ip = req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || "unknown"
    return `ip:${ip}`
  }

  // Apply rate limiting with burst handling
  const result = await rateLimiter.handleBurst(request, {
    ...config,
    name: configName,
    burstMax: config.max * 1.5, // Allow 50% burst
    keyGenerator,
    onLimitReached: async (req, key) => {
      await logRateLimitViolation(req, path, key)
    },
  })

  // Create response with rate limit headers
  const headers = new Headers()

  if (config.standardHeaders) {
    headers.set("RateLimit-Limit", result.limit.toString())
    headers.set("RateLimit-Remaining", result.remaining.toString())
    headers.set("RateLimit-Reset", result.reset.toISOString())
  }

  if (config.legacyHeaders) {
    headers.set("X-RateLimit-Limit", result.limit.toString())
    headers.set("X-RateLimit-Remaining", result.remaining.toString())
    headers.set("X-RateLimit-Reset", Math.floor(result.reset.getTime() / 1000).toString())
  }

  if (!result.success) {
    // Check for abuse patterns
    const ipAddress =
      request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip") || "unknown"

    const isAbuse = await detectAbusePattern((token?.id as string) || null, ipAddress, path)

    if (isAbuse) {
      // Temporary lockout for abusive behavior
      headers.set("Retry-After", "3600") // 1 hour lockout

      return NextResponse.json(
        {
          error:
            "Too many requests. Your access has been temporarily suspended due to repeated violations.",
          retryAfter: 3600,
        },
        {
          status: 429,
          headers,
        }
      )
    }

    // Normal rate limit response
    headers.set("Retry-After", result.retryAfter?.toString() || "60")

    return NextResponse.json(
      {
        error: "Too many requests. Please try again later.",
        retryAfter: result.retryAfter,
      },
      {
        status: 429,
        headers,
      }
    )
  }

  // Add rate limit headers to successful responses
  const response = NextResponse.next()
  headers.forEach((value, key) => {
    response.headers.set(key, value)
  })

  return response
}

/**
 * Rate limit configuration for specific endpoints
 * Can be used to override default rate limits
 */
export function createEndpointRateLimiter(config: {
  windowMs: number
  max: number
  skipSuccessfulRequests?: boolean
  skipFailedRequests?: boolean
}) {
  return async (request: NextRequest) => {
    const token = await getToken({
      req: request as any,
      secret: process.env.NEXTAUTH_SECRET,
    })

    const result = await rateLimiter.limit(request, {
      ...config,
      name: `custom-${request.nextUrl.pathname}`,
      standardHeaders: true,
      legacyHeaders: false,
      keyGenerator: (req) => {
        if (token?.id) return `user:${token.id}`
        const ip = req.headers.get("x-forwarded-for") || "unknown"
        return `ip:${ip}`
      },
    })

    if (!result.success) {
      return NextResponse.json(
        { error: "Rate limit exceeded", retryAfter: result.retryAfter },
        {
          status: 429,
          headers: {
            "Retry-After": result.retryAfter?.toString() || "60",
            "RateLimit-Limit": result.limit.toString(),
            "RateLimit-Remaining": "0",
            "RateLimit-Reset": result.reset.toISOString(),
          },
        }
      )
    }

    return null // Continue processing
  }
}
