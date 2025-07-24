import { NextRequest, NextResponse } from "next/server"
import { getToken } from "next-auth/jwt"
import { log } from "@/lib/logger-edge"

// Simple in-memory rate limiter for Edge Runtime
const rateLimitStore = new Map<string, { count: number; resetTime: number }>()

// Rate limit configurations
const rateLimitConfigs = {
  global: { windowMs: 60000, max: 100 },
  auth: { windowMs: 300000, max: 10 },
  api: { windowMs: 60000, max: 60 },
  search: { windowMs: 60000, max: 30 },
}

export async function rateLimitMiddleware(request: NextRequest) {
  const path = request.nextUrl.pathname

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

  // Get user info for better rate limiting
  const token = await getToken({
    req: request,
    secret: process.env.NEXTAUTH_SECRET,
  })

  // Create rate limit key
  const key = token?.sub
    ? `user:${token.sub}:${configName}`
    : `ip:${request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip") || "unknown"}:${configName}`

  const now = Date.now()
  const windowStart = now - config.windowMs

  // Get or create rate limit entry
  let entry = rateLimitStore.get(key)

  // Clean up old entries periodically
  if (rateLimitStore.size > 10000) {
    for (const [k, v] of rateLimitStore.entries()) {
      if (v.resetTime < now) {
        rateLimitStore.delete(k)
      }
    }
  }

  if (!entry || entry.resetTime < now) {
    entry = { count: 0, resetTime: now + config.windowMs }
    rateLimitStore.set(key, entry)
  }

  entry.count++

  const headers = new Headers()
  headers.set("X-RateLimit-Limit", config.max.toString())
  headers.set("X-RateLimit-Remaining", Math.max(0, config.max - entry.count).toString())
  headers.set("X-RateLimit-Reset", Math.floor(entry.resetTime / 1000).toString())

  if (entry.count > config.max) {
    const retryAfter = Math.ceil((entry.resetTime - now) / 1000)
    headers.set("Retry-After", retryAfter.toString())

    log.warn("Rate limit exceeded", {
      key,
      path,
      method: request.method,
      count: entry.count,
      limit: config.max,
    })

    return NextResponse.json(
      {
        error: "Too many requests. Please try again later.",
        retryAfter,
      },
      {
        status: 429,
        headers,
      }
    )
  }

  // Add rate limit headers to successful response
  const response = NextResponse.next()
  headers.forEach((value, key) => {
    response.headers.set(key, value)
  })

  return response
}
