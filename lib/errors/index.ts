import { log } from "@/lib/logger"
import { CorrelationTracking } from "@/lib/security/correlation"

// Base error interface
export interface ErrorContext {
  correlationId?: string
  userId?: string
  operation?: string
  metadata?: Record<string, any>
}

// Error categories
export enum ErrorCategory {
  AUTHENTICATION = "AUTHENTICATION",
  AUTHORIZATION = "AUTHORIZATION",
  VALIDATION = "VALIDATION",
  BUSINESS_LOGIC = "BUSINESS_LOGIC",
  EXTERNAL_SERVICE = "EXTERNAL_SERVICE",
  DATABASE = "DATABASE",
  RATE_LIMIT = "RATE_LIMIT",
  SECURITY = "SECURITY",
  SYSTEM = "SYSTEM",
}

// Base application error class
export abstract class ApplicationError extends Error {
  public readonly category: ErrorCategory
  public readonly statusCode: number
  public readonly isOperational: boolean
  public readonly context: ErrorContext
  public readonly timestamp: Date

  constructor(
    message: string,
    category: ErrorCategory,
    statusCode: number,
    isOperational: boolean = true,
    context: ErrorContext = {}
  ) {
    super(message)
    this.name = this.constructor.name
    this.category = category
    this.statusCode = statusCode
    this.isOperational = isOperational
    this.context = context
    this.timestamp = new Date()

    // Capture stack trace
    Error.captureStackTrace(this, this.constructor)
  }

  // Convert to safe client response
  toClientResponse(): {
    error: string
    code: string
    correlationId?: string
    timestamp: string
  } {
    return {
      error: this.getClientMessage(),
      code: this.getErrorCode(),
      correlationId: this.context.correlationId,
      timestamp: this.timestamp.toISOString(),
    }
  }

  // Get a safe message for the client
  protected abstract getClientMessage(): string

  // Get a unique error code
  protected abstract getErrorCode(): string

  // Log the error with context
  async logError(): Promise<void> {
    const correlationId =
      this.context.correlationId || (await CorrelationTracking.getCorrelationId())

    await log.error(this.message, this, {
      category: this.category,
      code: this.getErrorCode(),
      statusCode: this.statusCode,
      isOperational: this.isOperational,
      context: {
        ...this.context,
        correlationId,
      },
      operation: this.context.operation || "unknown",
    })
  }
}

// Authentication errors
export class AuthenticationError extends ApplicationError {
  constructor(message: string, context?: ErrorContext) {
    super(message, ErrorCategory.AUTHENTICATION, 401, true, context)
  }

  protected getClientMessage(): string {
    return "Authentication failed. Please check your credentials and try again."
  }

  protected getErrorCode(): string {
    return "AUTH_FAILED"
  }
}

export class SessionExpiredError extends ApplicationError {
  constructor(context?: ErrorContext) {
    super("Session has expired", ErrorCategory.AUTHENTICATION, 401, true, context)
  }

  protected getClientMessage(): string {
    return "Your session has expired. Please sign in again."
  }

  protected getErrorCode(): string {
    return "SESSION_EXPIRED"
  }
}

// Authorization errors
export class AuthorizationError extends ApplicationError {
  constructor(message: string, context?: ErrorContext) {
    super(message, ErrorCategory.AUTHORIZATION, 403, true, context)
  }

  protected getClientMessage(): string {
    return "You do not have permission to perform this action."
  }

  protected getErrorCode(): string {
    return "FORBIDDEN"
  }
}

// Validation errors
export class ValidationError extends ApplicationError {
  public readonly validationErrors: Record<string, string[]>

  constructor(
    message: string,
    validationErrors: Record<string, string[]> = {},
    context?: ErrorContext
  ) {
    super(message, ErrorCategory.VALIDATION, 400, true, context)
    this.validationErrors = validationErrors
  }

  protected getClientMessage(): string {
    const errorCount = Object.keys(this.validationErrors).length
    if (errorCount === 0) {
      return "The request contains invalid data."
    }
    return `Validation failed: ${errorCount} error(s) found.`
  }

  protected getErrorCode(): string {
    return "VALIDATION_ERROR"
  }

  toClientResponse() {
    const base = super.toClientResponse()
    return {
      ...base,
      errors: this.validationErrors,
    }
  }
}

// Business logic errors
export class BusinessLogicError extends ApplicationError {
  constructor(message: string, statusCode: number = 400, context?: ErrorContext) {
    super(message, ErrorCategory.BUSINESS_LOGIC, statusCode, true, context)
  }

  protected getClientMessage(): string {
    // Business logic errors can often be shown to the user
    return this.message
  }

  protected getErrorCode(): string {
    return "BUSINESS_ERROR"
  }
}

// Rate limit errors
export class RateLimitError extends ApplicationError {
  public readonly retryAfter: number

  constructor(retryAfter: number, context?: ErrorContext) {
    super(
      `Rate limit exceeded. Retry after ${retryAfter} seconds.`,
      ErrorCategory.RATE_LIMIT,
      429,
      true,
      context
    )
    this.retryAfter = retryAfter
  }

  protected getClientMessage(): string {
    return `Too many requests. Please try again in ${this.retryAfter} seconds.`
  }

  protected getErrorCode(): string {
    return "RATE_LIMIT_EXCEEDED"
  }

  toClientResponse() {
    const base = super.toClientResponse()
    return {
      ...base,
      retryAfter: this.retryAfter,
    }
  }
}

// Security errors
export class SecurityError extends ApplicationError {
  constructor(message: string, context?: ErrorContext) {
    super(message, ErrorCategory.SECURITY, 403, true, context)
  }

  protected getClientMessage(): string {
    // Never expose security details to the client
    return "Security validation failed."
  }

  protected getErrorCode(): string {
    return "SECURITY_ERROR"
  }
}

// Database errors
export class DatabaseError extends ApplicationError {
  constructor(message: string, context?: ErrorContext) {
    super(message, ErrorCategory.DATABASE, 500, false, context)
  }

  protected getClientMessage(): string {
    return "A database error occurred. Please try again later."
  }

  protected getErrorCode(): string {
    return "DATABASE_ERROR"
  }
}

// External service errors (extends existing patterns)
export class ExternalServiceError extends ApplicationError {
  public readonly service: string
  public readonly originalError?: any

  constructor(
    service: string,
    message: string,
    statusCode: number = 503,
    originalError?: any,
    context?: ErrorContext
  ) {
    super(`${service} error: ${message}`, ErrorCategory.EXTERNAL_SERVICE, statusCode, true, context)
    this.service = service
    this.originalError = originalError
  }

  protected getClientMessage(): string {
    return `The ${this.service} service is currently unavailable. Please try again later.`
  }

  protected getErrorCode(): string {
    return `${this.service.toUpperCase()}_ERROR`
  }
}

// System errors
export class SystemError extends ApplicationError {
  constructor(message: string, context?: ErrorContext) {
    super(message, ErrorCategory.SYSTEM, 500, false, context)
  }

  protected getClientMessage(): string {
    return "An unexpected error occurred. Please try again later."
  }

  protected getErrorCode(): string {
    return "SYSTEM_ERROR"
  }
}

// Error factory
export class ErrorFactory {
  static createFromError(
    error: unknown,
    defaultMessage: string = "An unexpected error occurred",
    context?: ErrorContext
  ): ApplicationError {
    // If it's already an ApplicationError, return it
    if (error instanceof ApplicationError) {
      return error
    }

    // Handle Prisma errors
    if (error && typeof error === "object" && "code" in error) {
      const prismaError = error as any
      if (prismaError.code === "P2002") {
        return new ValidationError(
          "A record with this value already exists",
          { unique: ["This value must be unique"] },
          context
        )
      }
      if (prismaError.code === "P2025") {
        return new BusinessLogicError("Record not found", 404, context)
      }
      // Add more Prisma error mappings as needed
    }

    // Handle standard errors
    if (error instanceof Error) {
      return new SystemError(error.message || defaultMessage, context)
    }

    // Handle unknown errors
    return new SystemError(defaultMessage, context)
  }

  static async handleError(error: unknown, context?: ErrorContext): Promise<ApplicationError> {
    const appError = this.createFromError(error, undefined, context)
    await appError.logError()
    return appError
  }

  // Utility method to check if an error is operational
  static isOperationalError(error: Error): boolean {
    if (error instanceof ApplicationError) {
      return error.isOperational
    }
    return false
  }
}
