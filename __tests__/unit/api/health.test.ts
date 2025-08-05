// Mock NextRequest first
jest.mock("next/server", () => {
  class MockNextRequest {
    url: string
    method: string
    headers: any

    constructor(url: string, init?: RequestInit) {
      this.url = url
      this.method = init?.method || "GET"
      this.headers = {
        get: () => null,
        has: () => false,
      }
    }
  }

  return {
    NextRequest: MockNextRequest,
    NextResponse: {
      json: (data: any, init?: ResponseInit) => ({
        status: init?.status || 200,
        json: async () => data,
      }),
    },
  }
})

import { GET as healthGET } from "@/app/api/health/route"
import { GET as liveGET } from "@/app/api/health/live/route"
import { GET as readyGET } from "@/app/api/health/ready/route"
import { NextRequest } from "next/server"
import { HealthCheckService } from "@/lib/monitoring/health-check"

// Mock the health check service
jest.mock("@/lib/monitoring/health-check")

describe("Health Check Endpoints", () => {
  const mockRequest = new NextRequest("http://localhost:3000/api/health")

  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe("GET /api/health", () => {
    it("should return healthy status when all checks pass", async () => {
      const mockHealth = {
        status: "healthy",
        timestamp: new Date().toISOString(),
        version: "0.3.0",
        uptime: 3600,
        checks: {
          database: { status: "up", responseTime: 10 },
          hubspot: { status: "up", responseTime: 200 },
          dwolla: { status: "up", responseTime: 150 },
          memory: { status: "up", details: { percentUsed: 45 } },
        },
      }

      ;(HealthCheckService.checkHealth as jest.Mock).mockResolvedValueOnce(mockHealth)

      const response = await healthGET(mockRequest)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data).toEqual(mockHealth)
    })

    it("should return 503 when status is unhealthy", async () => {
      const mockHealth = {
        status: "unhealthy",
        timestamp: new Date().toISOString(),
        version: "0.3.0",
        uptime: 3600,
        checks: {
          database: { status: "down", message: "Connection failed" },
          hubspot: { status: "up" },
          dwolla: { status: "up" },
          memory: { status: "up" },
        },
      }

      ;(HealthCheckService.checkHealth as jest.Mock).mockResolvedValueOnce(mockHealth)

      const response = await healthGET(mockRequest)
      const data = await response.json()

      expect(response.status).toBe(503)
      expect(data.status).toBe("unhealthy")
    })

    it("should handle errors gracefully", async () => {
      ;(HealthCheckService.checkHealth as jest.Mock).mockRejectedValueOnce(
        new Error("Health check failed")
      )

      const response = await healthGET(mockRequest)
      const data = await response.json()

      expect(response.status).toBe(503)
      expect(data.status).toBe("unhealthy")
      expect(data.error).toBe("Health check failed")
    })
  })

  describe("GET /api/health/live", () => {
    it("should return 200 when service is alive", async () => {
      const mockLiveness = {
        status: "ok",
        timestamp: new Date().toISOString(),
      }

      ;(HealthCheckService.checkLiveness as jest.Mock).mockResolvedValueOnce(mockLiveness)

      const response = await liveGET(mockRequest)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.status).toBe("ok")
    })

    it("should return 503 when liveness check fails", async () => {
      ;(HealthCheckService.checkLiveness as jest.Mock).mockRejectedValueOnce(
        new Error("Service dead")
      )

      const response = await liveGET(mockRequest)
      const data = await response.json()

      expect(response.status).toBe(503)
      expect(data.status).toBe("error")
    })
  })

  describe("GET /api/health/ready", () => {
    it("should return 200 when service is ready", async () => {
      const mockReadiness = {
        ready: true,
        status: "healthy",
        timestamp: new Date().toISOString(),
        version: "0.3.0",
        uptime: 3600,
        checks: {
          database: { status: "up" },
          hubspot: { status: "up" },
          dwolla: { status: "up" },
          memory: { status: "up", details: { percentUsed: 45 } },
        },
        errors: [],
      }

      ;(HealthCheckService.checkReadiness as jest.Mock).mockResolvedValueOnce(mockReadiness)

      const response = await readyGET(mockRequest)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.ready).toBe(true)
      expect(data.errors).toHaveLength(0)
    })

    it("should return 503 when service is not ready", async () => {
      const mockReadiness = {
        ready: false,
        status: "unhealthy",
        timestamp: new Date().toISOString(),
        version: "0.3.0",
        uptime: 3600,
        checks: {
          database: { status: "down" },
          hubspot: { status: "up" },
          dwolla: { status: "up" },
          memory: { status: "up" },
        },
        errors: ["Database connection failed"],
      }

      ;(HealthCheckService.checkReadiness as jest.Mock).mockResolvedValueOnce(mockReadiness)

      const response = await readyGET(mockRequest)
      const data = await response.json()

      expect(response.status).toBe(503)
      expect(data.ready).toBe(false)
      expect(data.errors).toContain("Database connection failed")
    })
  })
})
