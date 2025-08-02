import { NextRequest, NextResponse } from "next/server"
import { metrics } from "./metrics"
import { log } from "@/lib/logger"

export function monitoringMiddleware(request: NextRequest) {
  const start = Date.now()
  const method = request.method
  const path = request.nextUrl.pathname

  // Increment active connections
  metrics.incrementGauge("active_connections")

  // Create a proxy for the response to capture status code
  const originalResponse = NextResponse.next()

  // Capture metrics after response
  const response = originalResponse
  
  // Schedule metrics collection (non-blocking)
  queueMicrotask(() => {
    const duration = Date.now() - start
    const status = response.status || 200

    // Record request metrics
    metrics.incrementCounter("http_requests_total", 1, {
      method,
      path: sanitizePath(path),
      status: String(status),
    })

    metrics.recordHistogram("http_request_duration_ms", duration, {
      method,
      path: sanitizePath(path),
      status: String(status),
    })

    // Decrement active connections
    metrics.decrementGauge("active_connections")

    // Log slow requests
    if (duration > 1000) {
      log.warn("Slow request detected", {
        method,
        path,
        duration,
        status,
        operation: "http_request",
      })
    }

    // Record errors
    if (status >= 400) {
      metrics.incrementCounter("errors_total", 1, {
        method,
        path: sanitizePath(path),
        status: String(status),
      })
    }

    // Record specific endpoint metrics
    if (path.includes("/api/search")) {
      metrics.incrementCounter("search_requests_total", 1, {
        method,
        status: String(status),
      })
    }
  })
  
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

/**
 * Track database query metrics
 */
export function trackDatabaseQuery(operation: string, duration: number) {
  metrics.recordHistogram("db_query_duration_ms", duration, {
    operation,
  })
}

/**
 * Track API call metrics
 */
export function trackAPICall(service: "hubspot" | "dwolla", success: boolean, duration: number) {
  const counterName = `${service}_api_calls_total`
  metrics.incrementCounter(counterName, 1, {
    status: success ? "success" : "failure",
  })

  // Also track duration
  metrics.recordHistogram("external_api_duration_ms", duration, {
    service,
    status: success ? "success" : "failure",
  })
}

/**
 * Track cache metrics
 */
export function trackCacheOperation(hit: boolean) {
  if (hit) {
    metrics.incrementCounter("cache_hits_total")
  } else {
    metrics.incrementCounter("cache_misses_total")
  }
}
