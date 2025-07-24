import { RateLimiter } from "@/lib/security/rate-limit"
import { NextRequest } from "next/server"

describe("RateLimiter", () => {
  let rateLimiter: RateLimiter

  beforeEach(() => {
    rateLimiter = new RateLimiter()
  })

  const createMockRequest = (ip: string, userId?: string) => {
    const headers = new Headers()
    headers.set("x-forwarded-for", ip)

    return {
      headers,
      ip,
    } as unknown as NextRequest
  }

  describe("limit", () => {
    it("should allow requests within rate limit", async () => {
      const request = createMockRequest("192.168.1.1")
      const config = {
        windowMs: 60000,
        max: 5,
        keyGenerator: () => "192.168.1.1",
      }

      for (let i = 0; i < 5; i++) {
        const result = await rateLimiter.limit(request, config)
        expect(result.success).toBe(true)
        expect(result.limit).toBe(5)
        expect(result.remaining).toBe(4 - i)
      }
    })

    it("should block requests exceeding rate limit", async () => {
      const request = createMockRequest("192.168.1.2")
      const config = {
        windowMs: 60000,
        max: 2,
        keyGenerator: () => "192.168.1.2",
      }

      // First two requests should succeed
      await rateLimiter.limit(request, config)
      await rateLimiter.limit(request, config)

      // Third request should be blocked
      const result = await rateLimiter.limit(request, config)
      expect(result.success).toBe(false)
      expect(result.remaining).toBe(0)
      expect(result.retryAfter).toBeGreaterThan(0)
    })

    it("should reset limits after window expires", async () => {
      const request = createMockRequest("192.168.1.3")
      const config = {
        windowMs: 100, // 100ms window for testing
        max: 1,
        keyGenerator: () => "192.168.1.3",
      }

      // First request should succeed
      const result1 = await rateLimiter.limit(request, config)
      expect(result1.success).toBe(true)

      // Second request should fail
      const result2 = await rateLimiter.limit(request, config)
      expect(result2.success).toBe(false)

      // Wait for window to expire
      await new Promise((resolve) => setTimeout(resolve, 150))

      // Third request should succeed (new window)
      const result3 = await rateLimiter.limit(request, config)
      expect(result3.success).toBe(true)
    })
  })

  describe("handleBurst", () => {
    it("should allow burst requests up to 150% of limit", async () => {
      const request = createMockRequest("192.168.1.4")
      const config = {
        windowMs: 60000,
        max: 10,
        keyGenerator: () => "192.168.1.4",
      }

      // Fill up normal limit
      for (let i = 0; i < 10; i++) {
        await rateLimiter.limit(request, config)
      }

      // Burst should allow up to 5 more requests (50% of 10)
      for (let i = 0; i < 5; i++) {
        const result = await rateLimiter.handleBurst(request, config)
        expect(result.success).toBe(true)
        expect(result.burst).toBe(true)
      }

      // 16th request should fail even with burst
      const result = await rateLimiter.handleBurst(request, config)
      expect(result.success).toBe(false)
    })

    it("should apply exponential backoff for burst requests", async () => {
      const request = createMockRequest("192.168.1.5")
      const config = {
        windowMs: 60000,
        max: 2,
        keyGenerator: () => "192.168.1.5",
      }

      // Fill normal limit
      await rateLimiter.limit(request, config)
      await rateLimiter.limit(request, config)

      // First burst request
      const burst1 = await rateLimiter.handleBurst(request, config)
      expect(burst1.success).toBe(true)
      expect(burst1.penalty).toBeDefined()

      // Penalty should increase for subsequent burst requests
      const burst2 = await rateLimiter.handleBurst(request, config)
      if (burst2.success && burst2.penalty && burst1.penalty) {
        expect(burst2.penalty).toBeGreaterThan(burst1.penalty)
      }
    })
  })

  describe("abuse detection", () => {
    it("should track rate limit violations", async () => {
      const request = createMockRequest("192.168.1.6")
      const config = {
        windowMs: 60000,
        max: 1,
        keyGenerator: () => "192.168.1.6",
      }

      // First request succeeds
      await rateLimiter.limit(request, config)

      // Track violations
      for (let i = 0; i < 5; i++) {
        const result = await rateLimiter.limit(request, config)
        expect(result.success).toBe(false)
        expect(result.violations).toBe(i + 1)
      }
    })

    it("should detect abuse patterns", async () => {
      const request = createMockRequest("192.168.1.7")
      const config = {
        windowMs: 100, // Short window for testing
        max: 1,
        keyGenerator: () => "192.168.1.7",
      }

      // Generate many violations quickly
      for (let i = 0; i < 11; i++) {
        await rateLimiter.limit(request, config)
        await rateLimiter.limit(request, config) // Second request always fails
      }

      // Check last result for abuse detection
      const result = await rateLimiter.limit(request, config)
      expect(result.success).toBe(false)
      expect(result.violations).toBeGreaterThanOrEqual(10)
      expect(result.abuseLockout).toBe(true)
    })
  })
})
