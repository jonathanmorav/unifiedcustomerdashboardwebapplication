import { NextResponse } from "next/server"
import { HealthCheckService } from "@/lib/monitoring/health-check"
import { log } from "@/lib/logger"

/**
 * GET /api/health
 * Basic health check endpoint
 */
export async function GET() {
  try {
    const health = await HealthCheckService.checkHealth()

    // Return appropriate status code based on health
    const statusCode = health.status === "healthy" ? 200 : health.status === "degraded" ? 200 : 503

    return NextResponse.json(health, { status: statusCode })
  } catch (error) {
    log.error("Health check failed", error as Error, {
      operation: "health_check",
    })

    return NextResponse.json(
      {
        status: "unhealthy",
        timestamp: new Date().toISOString(),
        error: "Health check failed",
      },
      { status: 503 }
    )
  }
}
