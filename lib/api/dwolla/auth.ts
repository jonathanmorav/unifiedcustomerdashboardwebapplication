import { getEnv } from "@/lib/env"
import type { DwollaTokenResponse } from "@/lib/types/dwolla"
import { log } from "@/lib/logger"

export class DwollaAuthError extends Error {
  constructor(
    message: string,
    public status?: number
  ) {
    super(message)
    this.name = "DwollaAuthError"
  }
}

interface DwollaTokenManagerConfig {
  tokenExpiryBufferSeconds?: number
}

export class DwollaTokenManager {
  private accessToken: string | null = null
  private tokenExpiryTimestamp: number | null = null
  private refreshPromise: Promise<string> | null = null
  private key: string
  private secret: string
  private baseUrl: string
  private tokenExpiryBufferMs: number

  constructor(config: DwollaTokenManagerConfig = {}) {
    const env = getEnv()
    this.key = env.DWOLLA_KEY
    this.secret = env.DWOLLA_SECRET

    // Use the appropriate auth URL based on environment
    this.baseUrl =
      env.DWOLLA_ENVIRONMENT === "production"
        ? "https://accounts.dwolla.com"
        : "https://accounts-sandbox.dwolla.com"

    // Default 5 minute buffer, configurable
    const bufferSeconds = config.tokenExpiryBufferSeconds || 300
    this.tokenExpiryBufferMs = bufferSeconds * 1000
  }

  /**
   * Get a valid access token, refreshing if necessary
   */
  async getAccessToken(): Promise<string> {
    // Check if we have a valid token
    if (this.accessToken && this.tokenExpiryTimestamp && Date.now() < this.tokenExpiryTimestamp) {
      return this.accessToken
    }

    // If a refresh is already in progress, wait for it
    if (this.refreshPromise) {
      return this.refreshPromise
    }

    // Otherwise, start a new refresh
    this.refreshPromise = this.refreshAccessToken()

    try {
      const token = await this.refreshPromise
      return token
    } finally {
      // Clear the promise after completion (success or failure)
      this.refreshPromise = null
    }
  }

  /**
   * Refresh the access token using client credentials
   */
  private async refreshAccessToken(): Promise<string> {
    const startTime = Date.now()

    try {
      const response = await fetch(`${this.baseUrl}/token`, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          Authorization: `Basic ${Buffer.from(`${this.key}:${this.secret}`).toString(
            "base64"
          )}`,
        },
        body: new URLSearchParams({
          grant_type: "client_credentials",
        }),
      })

      if (!response.ok) {
        const errorText = await response.text()

        // Sanitize error message for production
        const sanitizedError = this.sanitizeErrorMessage(errorText, response.status)

        // Log full error internally
        log.error("[DwollaAuth] Token refresh failed", new Error(errorText), {
          status: response.status,
          operation: 'dwolla_token_refresh'
        })

        throw new DwollaAuthError(sanitizedError, response.status)
      }

      const data: DwollaTokenResponse = await response.json()

      // Store the token and calculate expiry timestamp
      this.accessToken = data.access_token

      // Calculate expiry with buffer
      const expiryMs = data.expires_in * 1000 - this.tokenExpiryBufferMs
      this.tokenExpiryTimestamp = startTime + expiryMs

      // Log success
      log.debug("[DwollaAuth] Token refreshed successfully", {
        expiresIn: data.expires_in,
        bufferSeconds: this.tokenExpiryBufferMs / 1000,
        expiryTimestamp: new Date(this.tokenExpiryTimestamp).toISOString(),
        operation: 'dwolla_token_success'
      })

      return this.accessToken
    } catch (error) {
      // Clear cached token on error
      this.clearToken()

      if (error instanceof DwollaAuthError) {
        throw error
      }

      // Log network errors internally
      log.error("[DwollaAuth] Network error", error as Error, {
        operation: 'dwolla_auth_network_error'
      })

      throw new DwollaAuthError(
        "Failed to authenticate with Dwolla. Please check your connection and try again."
      )
    }
  }

  /**
   * Clear the stored token (useful for forcing a refresh)
   */
  clearToken(): void {
    this.accessToken = null
    this.tokenExpiryTimestamp = null
    this.refreshPromise = null
  }

  /**
   * Sanitize error messages to avoid exposing sensitive information
   */
  private sanitizeErrorMessage(errorText: string, status: number): string {
    // In production, return generic messages based on status code
    if (getEnv().NODE_ENV === "production") {
      switch (status) {
        case 400:
          return "Invalid authentication request"
        case 401:
          return "Invalid client credentials"
        case 403:
          return "Access forbidden - please check your Dwolla account permissions"
        case 429:
          return "Too many requests - please try again later"
        case 500:
        case 502:
        case 503:
        case 504:
          return "Dwolla service temporarily unavailable"
        default:
          return `Authentication failed (error ${status})`
      }
    }

    // In development, return more detailed error but still truncate if too long
    const maxLength = 200
    if (errorText.length > maxLength) {
      return errorText.substring(0, maxLength) + "..."
    }

    return errorText
  }

  /**
   * Check if token is valid (for debugging/monitoring)
   */
  isTokenValid(): boolean {
    return !!(
      this.accessToken &&
      this.tokenExpiryTimestamp &&
      Date.now() < this.tokenExpiryTimestamp
    )
  }

  /**
   * Get token expiry time (for debugging/monitoring)
   */
  getTokenExpiry(): Date | null {
    return this.tokenExpiryTimestamp ? new Date(this.tokenExpiryTimestamp) : null
  }
}
