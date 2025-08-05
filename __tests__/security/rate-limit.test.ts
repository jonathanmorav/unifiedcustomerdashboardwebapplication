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
    it("should allow burst requests when normal limit is exceeded", async () => {
      const request = createMockRequest("192.168.1.4")
      const config = {
        name: "test-burst",
        windowMs: 60000,
        max: 10,
        burstMax: 15, // Burst allows 15 total in double window
        keyGenerator: () => "192.168.1.4",
      }

      // Fill up normal limit
      for (let i = 0; i < 10; i++) {
        const result = await rateLimiter.limit(request, config)
        expect(result.success).toBe(true)
      }

      // Next normal request should fail
      const normalResult = await rateLimiter.limit(request, config)
      expect(normalResult.success).toBe(false)

      // But handleBurst should allow more requests
      // The burst uses a separate counter with max=15 in a double window
      // So it should allow all 15 requests in the burst window
      for (let i = 0; i < 15; i++) {
        const result = await rateLimiter.handleBurst(request, config)
        expect(result.success).toBe(true)
      }

      // 16th burst request should fail
      const failResult = await rateLimiter.handleBurst(request, config)
      expect(failResult.success).toBe(false)
    })

    it("should apply retry after for burst requests", async () => {
      const request = createMockRequest("192.168.1.5")
      const config = {
        name: "test-retry",
        windowMs: 60000,
        max: 2,
        burstMax: 3,
        keyGenerator: () => "192.168.1.5",
      }

      // Fill normal limit
      await rateLimiter.limit(request, config)
      await rateLimiter.limit(request, config)

      // First burst request should succeed with retryAfter
      const burst1 = await rateLimiter.handleBurst(request, config)
      expect(burst1.success).toBe(true)
      // retryAfter should be set for burst requests
      expect(burst1.retryAfter).toBeDefined()
    })
  })

  describe("rate limit behavior", () => {
    it("should track remaining requests correctly", async () => {
      const request = createMockRequest("192.168.1.6")
      const config = {
        name: "test-remaining",
        windowMs: 60000,
        max: 3,
        keyGenerator: () => "192.168.1.6",
      }

      // First request succeeds with max-1 remaining
      const result1 = await rateLimiter.limit(request, config)
      expect(result1.success).toBe(true)
      expect(result1.remaining).toBe(2)

      // Second request
      const result2 = await rateLimiter.limit(request, config)
      expect(result2.success).toBe(true)
      expect(result2.remaining).toBe(1)

      // Third request
      const result3 = await rateLimiter.limit(request, config)
      expect(result3.success).toBe(true)
      expect(result3.remaining).toBe(0)

      // Fourth request should fail
      const result4 = await rateLimiter.limit(request, config)
      expect(result4.success).toBe(false)
      expect(result4.remaining).toBe(0)
    })

    it("should provide retry after information", async () => {
      const request = createMockRequest("192.168.1.7")
      const config = {
        name: "test-retry-after",
        windowMs: 60000,
        max: 1,
        keyGenerator: () => "192.168.1.7",
      }

      // First request succeeds
      await rateLimiter.limit(request, config)

      // Second request should fail with retry info
      const result = await rateLimiter.limit(request, config)
      expect(result.success).toBe(false)
      expect(result.retryAfter).toBeDefined()
      expect(result.retryAfter).toBeGreaterThan(0)
      expect(result.reset).toBeInstanceOf(Date)
    })
  })
})
