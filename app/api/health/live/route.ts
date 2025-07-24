import { NextResponse } from "next/server"
import { HealthCheckService } from "@/lib/monitoring/health-check"

/**
 * GET /api/health/live
 * Kubernetes liveness probe endpoint
 * Returns 200 if the service is alive, regardless of dependency status
 */
export async function GET() {
  try {
    const result = await HealthCheckService.checkLiveness()
    return NextResponse.json(result, { status: 200 })
  } catch (_error) {
    // If we can't even perform a basic liveness check, the service is dead
    return NextResponse.json(
      {
        status: "error",
        timestamp: new Date().toISOString(),
      },
      { status: 503 }
    )
  }
}
