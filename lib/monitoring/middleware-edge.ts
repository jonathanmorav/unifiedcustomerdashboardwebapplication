import { NextRequest, NextResponse } from "next/server"
import { log } from "@/lib/logger-edge"

// Simple metrics tracking for Edge Runtime
const metricsStore = {
  activeConnections: 0,
  totalRequests: 0,
  errorCount: 0,
  slowRequests: 0,
}

export function monitoringMiddleware(request: NextRequest) {
  const start = Date.now()
  const method = request.method
  const path = request.nextUrl.pathname

  // Increment active connections
  metricsStore.activeConnections++
  metricsStore.totalRequests++

  // Log request start
  log.debug("Request started", {
    method,
    path,
    activeConnections: metricsStore.activeConnections,
  })

  // Return the response immediately for Edge Runtime
  const response = NextResponse.next()

  // Track metrics after response
  const duration = Date.now() - start
  metricsStore.activeConnections--

  // Log slow requests
  if (duration > 1000) {
    metricsStore.slowRequests++
    log.warn("Slow request detected", {
      method,
      path,
      duration,
      operation: "http_request",
    })
  }

  // Log metrics periodically (every 100 requests)
  if (metricsStore.totalRequests % 100 === 0) {
    log.info("Metrics snapshot", {
      totalRequests: metricsStore.totalRequests,
      activeConnections: metricsStore.activeConnections,
      errorCount: metricsStore.errorCount,
      slowRequests: metricsStore.slowRequests,
    })
  }

  return response
}

/**
 * Sanitize path for metrics labels
 * Removes dynamic segments to prevent high cardinality
 */
function sanitizePath(path: string): string {
  return (
    path
      // Remove UUIDs
      .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, ":id")
      // Remove numeric IDs
      .replace(/\/\d+/g, "/:id")
      // Remove query parameters
      .split("?")[0]
      // Normalize auth endpoints
      .replace(/\/api\/auth\/.+/, "/api/auth/:provider")
  )
}
