import { HubSpotAPIError } from "@/lib/api/hubspot/client"
import { DwollaAPIError } from "@/lib/api/dwolla/client"
import { ExternalServiceError, ErrorContext } from "./index"

/**
 * Adapter to convert existing API errors to our ApplicationError system
 */
export class APIErrorAdapter {
  /**
   * Convert HubSpot API error to ExternalServiceError
   */
  static fromHubSpotError(error: HubSpotAPIError, context?: ErrorContext): ExternalServiceError {
    return new ExternalServiceError("HubSpot", error.message, error.status || 503, error, {
      ...context,
      correlationId: error.correlationId || context?.correlationId,
      metadata: {
        ...context?.metadata,
        errors: error.errors,
      },
    })
  }

  /**
   * Convert Dwolla API error to ExternalServiceError
   */
  static fromDwollaError(error: DwollaAPIError, context?: ErrorContext): ExternalServiceError {
    return new ExternalServiceError("Dwolla", error.message, error.status || 503, error, {
      ...context,
      metadata: {
        ...context?.metadata,
        code: error.code,
        errors: error.errors,
      },
    })
  }

  /**
   * Check if an error is an API error and convert it
   */
  static convertIfAPIError(error: unknown, context?: ErrorContext): ExternalServiceError | null {
    if (error instanceof HubSpotAPIError) {
      return this.fromHubSpotError(error, context)
    }

    if (error instanceof DwollaAPIError) {
      return this.fromDwollaError(error, context)
    }

    return null
  }
}
