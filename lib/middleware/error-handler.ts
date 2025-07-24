import { NextRequest, NextResponse } from "next/server"
import { ApplicationError, ErrorFactory, SystemError } from "@/lib/errors"
import { APIErrorAdapter } from "@/lib/errors/api-errors"
import { CorrelationTracking } from "@/lib/security/correlation"
import { metrics } from "@/lib/monitoring/metrics"
import { log } from "@/lib/logger"

export interface ErrorHandlerOptions {
  logErrors?: boolean
  includeStackTrace?: boolean
  defaultStatusCode?: number
}

const DEFAULT_OPTIONS: ErrorHandlerOptions = {
  logErrors: true,
  includeStackTrace: process.env.NODE_ENV !== "production",
  defaultStatusCode: 500,
}

/**
 * Wrap an API route handler with error handling
 */
export function withErrorHandler<T extends (...args: any[]) => Promise<NextResponse>>(
  handler: T,
  options: ErrorHandlerOptions = {}
): T {
  const opts = { ...DEFAULT_OPTIONS, ...options }

  return (async (...args: Parameters<T>) => {
    const request = args[0] as NextRequest
    const correlationId = await CorrelationTracking.getCorrelationId()
    const requestId = request.headers.get("X-Request-ID") || crypto.randomUUID()

    try {
      // Execute the handler
      const response = await handler(...args)

      // Track successful requests
      metrics.incrementCounter("api_requests_total", {
        method: request.method,
        path: request.nextUrl.pathname,
        status: response.status.toString(),
      })

      return response
    } catch (error) {
      // Convert to ApplicationError if needed
      let appError: ApplicationError

      // Check if it's an API error first
      const apiError = APIErrorAdapter.convertIfAPIError(error, {
        correlationId,
        operation: `${request.method} ${request.nextUrl.pathname}`,
      })

      if (apiError) {
        appError = apiError
      } else if (error instanceof ApplicationError) {
        appError = error
      } else {
        appError = ErrorFactory.createFromError(error, undefined, {
          correlationId,
          operation: `${request.method} ${request.nextUrl.pathname}`,
        })
      }

      // Log the error if enabled
      if (opts.logErrors) {
        await appError.logError()
      }

      // Track error metrics
      metrics.incrementCounter("api_errors_total", {
        method: request.method,
        path: request.nextUrl.pathname,
        category: appError.category,
        code: appError.toClientResponse().code,
      })

      // Track error rate by category
      metrics.incrementCounter("api_errors_by_category", {
        category: appError.category,
      })

      // Build response
      const responseBody = appError.toClientResponse()

      // Add stack trace in development
      if (opts.includeStackTrace && appError.stack) {
        ;(responseBody as any).stack = appError.stack
      }

      // Create response with appropriate headers
      const response = NextResponse.json(responseBody, {
        status: appError.statusCode || opts.defaultStatusCode,
      })

      // Add correlation headers
      response.headers.set("X-Correlation-ID", correlationId)
      response.headers.set("X-Request-ID", requestId)

      // Add rate limit headers if applicable
      if ("retryAfter" in responseBody) {
        response.headers.set("Retry-After", responseBody.retryAfter.toString())
      }

      return response
    }
  }) as T
}

/**
 * Global error handler for unhandled errors in API routes
 */
export async function globalErrorHandler(
  error: unknown,
  request: NextRequest
): Promise<NextResponse> {
  const correlationId = await CorrelationTracking.getCorrelationId()

  // Create a system error for unhandled cases
  const systemError = new SystemError("An unhandled error occurred", {
    correlationId,
    operation: `${request.method} ${request.nextUrl.pathname}`,
  })

  await systemError.logError()

  // Log the original error for debugging
  await log.error("Unhandled error in API route", {
    error:
      error instanceof Error
        ? {
            name: error.name,
            message: error.message,
            stack: error.stack,
          }
        : error,
    correlationId,
    operation: "global_error_handler",
  })

  // Track unhandled errors
  metrics.incrementCounter("api_unhandled_errors_total", {
    method: request.method,
    path: request.nextUrl.pathname,
  })

  return NextResponse.json(systemError.toClientResponse(), {
    status: 500,
    headers: {
      "X-Correlation-ID": correlationId,
    },
  })
}

/**
 * Middleware to catch and handle errors in API routes
 */
export function errorHandlerMiddleware(request: NextRequest): void {
  // Set up global error handling for unhandled promise rejections
  if (typeof process !== "undefined") {
    process.on("unhandledRejection", async (reason, promise) => {
      await log.error("Unhandled Promise Rejection", {
        reason:
          reason instanceof Error
            ? {
                name: reason.name,
                message: reason.message,
                stack: reason.stack,
              }
            : reason,
        operation: "unhandled_rejection",
      })

      metrics.incrementCounter("unhandled_rejections_total")
    })
  }
}

/**
 * Utility to create error responses
 */
export class ErrorResponse {
  static unauthorized(message: string = "Unauthorized"): NextResponse {
    return NextResponse.json({ error: message }, { status: 401 })
  }

  static forbidden(message: string = "Forbidden"): NextResponse {
    return NextResponse.json({ error: message }, { status: 403 })
  }

  static badRequest(message: string = "Bad request"): NextResponse {
    return NextResponse.json({ error: message }, { status: 400 })
  }

  static notFound(message: string = "Not found"): NextResponse {
    return NextResponse.json({ error: message }, { status: 404 })
  }

  static serverError(message: string = "Internal server error"): NextResponse {
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
