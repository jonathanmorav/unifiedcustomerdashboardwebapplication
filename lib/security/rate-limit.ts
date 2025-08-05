import { NextRequest } from "next/server"
import { LRUCache } from "lru-cache"
import { prisma } from "@/lib/db"
import { log } from "@/lib/logger"

export interface RateLimitConfig {
  windowMs: number
  max: number
  standardHeaders: boolean
  legacyHeaders: boolean
  keyGenerator?: (req: NextRequest) => string
  skip?: (req: NextRequest) => boolean
  onLimitReached?: (req: NextRequest, key: string) => Promise<void>
}

export interface RateLimitResult {
  success: boolean
  limit: number
  remaining: number
  reset: Date
  retryAfter?: number
}

// Default rate limit configurations
export const rateLimitConfigs = {
  // Global rate limit
  global: {
    windowMs: 60 * 1000, // 1 minute
    max: 60, // requests per minute from env
    standardHeaders: true,
    legacyHeaders: false,
  },

  // Strict rate limit for auth endpoints
  auth: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5, // 5 attempts per 15 minutes
    standardHeaders: true,
    legacyHeaders: false,
  },

  // API rate limit
  api: {
    windowMs: 60 * 1000, // 1 minute
    max: 100, // 100 requests per minute
    standardHeaders: true,
    legacyHeaders: false,
  },

  // Search rate limit
  search: {
    windowMs: 60 * 1000, // 1 minute
    max: 30, // 30 searches per minute
    standardHeaders: true,
    legacyHeaders: false,
  },

  // Reconciliation rate limit - more restrictive due to computational cost
  reconciliation: {
    windowMs: 5 * 60 * 1000, // 5 minutes
    max: 5, // 5 reconciliation runs per 5 minutes
    standardHeaders: true,
    legacyHeaders: false,
  },

  // Premium reconciliation rate limit - very restrictive due to high cost
  premiumReconciliation: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 2, // 2 premium reconciliation runs per 15 minutes
    standardHeaders: true,
    legacyHeaders: false,
  },
}

export class RateLimiter {
  private stores: Map<string, LRUCache<string, number[]>>

  constructor() {
    this.stores = new Map()
  }

  private getStore(name: string): LRUCache<string, number[]> {
    if (!this.stores.has(name)) {
      this.stores.set(
        name,
        new LRUCache<string, number[]>({
          max: 10000, // Max 10k unique IPs/users
          ttl: 24 * 60 * 60 * 1000, // 24 hour TTL
        })
      )
    }
    return this.stores.get(name)!
  }

  async limit(
    request: NextRequest,
    config: RateLimitConfig & { name: string }
  ): Promise<RateLimitResult> {
    // Check if request should be skipped
    if (config.skip && config.skip(request)) {
      return {
        success: true,
        limit: config.max,
        remaining: config.max,
        reset: new Date(Date.now() + config.windowMs),
      }
    }

    // Generate key for rate limiting
    const key = config.keyGenerator
      ? config.keyGenerator(request)
      : this.defaultKeyGenerator(request)

    const store = this.getStore(config.name)
    const now = Date.now()
    const windowStart = now - config.windowMs

    // Get current hits
    let hits = store.get(key) || []

    // Remove old hits outside the window
    hits = hits.filter((timestamp) => timestamp > windowStart)

    // Check if limit exceeded
    if (hits.length >= config.max) {
      const oldestHit = Math.min(...hits)
      const resetTime = new Date(oldestHit + config.windowMs)
      const retryAfter = Math.ceil((resetTime.getTime() - now) / 1000)

      // Call limit reached handler if provided
      if (config.onLimitReached) {
        await config.onLimitReached(request, key)
      }

      return {
        success: false,
        limit: config.max,
        remaining: 0,
        reset: resetTime,
        retryAfter,
      }
    }

    // Add current hit
    hits.push(now)
    store.set(key, hits)

    const resetTime = new Date(now + config.windowMs)

    return {
      success: true,
      limit: config.max,
      remaining: config.max - hits.length,
      reset: resetTime,
    }
  }

  private defaultKeyGenerator(request: NextRequest): string {
    // Try to get user ID from session/JWT
    const userId = request.headers.get("x-user-id")
    if (userId) return `user:${userId}`

    // Fall back to IP address
    const ip =
      request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip") || "unknown"

    return `ip:${ip}`
  }

  // Burst handling - allows temporary burst with exponential backoff
  async handleBurst(
    request: NextRequest,
    config: RateLimitConfig & { name: string; burstMax: number }
  ): Promise<RateLimitResult> {
    const result = await this.limit(request, config)

    if (!result.success && config.burstMax) {
      // Check burst allowance
      const burstConfig = {
        ...config,
        name: `${config.name}-burst`,
        max: config.burstMax,
        windowMs: config.windowMs * 2, // Double window for burst
      }

      const burstResult = await this.limit(request, burstConfig)
      if (burstResult.success) {
        // Allow but with increased retry time
        return {
          ...burstResult,
          retryAfter: (burstResult.retryAfter || 0) * 2,
        }
      }
    }

    return result
  }
}

// Global rate limiter instance
export const rateLimiter = new RateLimiter()

// Helper function to log rate limit violations
export async function logRateLimitViolation(request: NextRequest, endpoint: string, key: string) {
  try {
    await prisma.auditLog.create({
      data: {
        action: "RATE_LIMIT_EXCEEDED",
        resource: endpoint,
        metadata: {
          key,
          method: request.method,
          userAgent: request.headers.get("user-agent"),
          timestamp: new Date().toISOString(),
        },
        ipAddress:
          request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip") || "unknown",
        userAgent: request.headers.get("user-agent") || undefined,
      },
    })
  } catch (error) {
    log.error("Failed to log rate limit violation", error as Error, {
      endpoint,
      key,
      operation: "rate_limit_logging",
    })
  }
}

// Helper function to check for potential abuse patterns
export async function detectAbusePattern(
  userId: string | null,
  ipAddress: string,
  endpoint: string
): Promise<boolean> {
  try {
    // Check for rapid violations in the last hour
    const recentViolations = await prisma.auditLog.count({
      where: {
        action: "RATE_LIMIT_EXCEEDED",
        resource: endpoint,
        createdAt: {
          gte: new Date(Date.now() - 60 * 60 * 1000), // Last hour
        },
        OR: [{ userId: userId || undefined }, { ipAddress }],
      },
    })

    // If more than 10 violations in an hour, it's likely abuse
    return recentViolations > 10
  } catch (error) {
    log.error("Failed to detect abuse pattern", error as Error, {
      userId,
      ipAddress,
      endpoint,
      operation: "abuse_detection",
    })
    return false
  }
}
