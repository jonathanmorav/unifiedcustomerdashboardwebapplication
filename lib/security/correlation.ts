import { headers } from 'next/headers'

/**
 * Correlation ID utilities for distributed tracing
 */
export class CorrelationTracking {
  static readonly CORRELATION_HEADER = 'X-Correlation-ID'
  static readonly REQUEST_ID_HEADER = 'X-Request-ID'

  /**
   * Get correlation ID from current request context
   */
  static async getCorrelationId(): Promise<string | null> {
    try {
      const headersList = await headers()
      return headersList.get(this.CORRELATION_HEADER)
    } catch {
      return null
    }
  }

  /**
   * Get request ID from current request context
   */
  static async getRequestId(): Promise<string | null> {
    try {
      const headersList = await headers()
      return headersList.get(this.REQUEST_ID_HEADER)
    } catch {
      return null
    }
  }

  /**
   * Add correlation headers to outgoing requests
   */
  static async addCorrelationHeaders(
    requestHeaders: HeadersInit = {}
  ): Promise<HeadersInit> {
    const correlationId = await this.getCorrelationId()
    const requestId = await this.getRequestId()

    const headers = new Headers(requestHeaders)
    
    if (correlationId) {
      headers.set(this.CORRELATION_HEADER, correlationId)
    }
    
    if (requestId) {
      headers.set('X-Parent-Request-ID', requestId)
    }

    return headers
  }

  /**
   * Create a traced fetch function that automatically includes correlation headers
   */
  static createTracedFetch() {
    return async (url: string, options?: RequestInit): Promise<Response> => {
      const tracedHeaders = await this.addCorrelationHeaders(options?.headers)
      
      return fetch(url, {
        ...options,
        headers: tracedHeaders,
      })
    }
  }

  /**
   * Log with correlation context
   */
  static async log(
    level: 'info' | 'warn' | 'error',
    message: string,
    data?: any
  ) {
    const correlationId = await this.getCorrelationId()
    const requestId = await this.getRequestId()

    const logData = {
      timestamp: new Date().toISOString(),
      level,
      message,
      correlationId,
      requestId,
      ...data,
    }

    console[level](JSON.stringify(logData))
  }
}

/**
 * Create a traced axios-like instance for external API calls
 */
export function createTracedApiClient(baseURL: string) {
  const tracedFetch = CorrelationTracking.createTracedFetch()

  return {
    async get(path: string, options?: RequestInit) {
      return tracedFetch(`${baseURL}${path}`, {
        ...options,
        method: 'GET',
      })
    },

    async post(path: string, data?: any, options?: RequestInit) {
      return tracedFetch(`${baseURL}${path}`, {
        ...options,
        method: 'POST',
        body: JSON.stringify(data),
        headers: {
          'Content-Type': 'application/json',
          ...options?.headers,
        },
      })
    },

    async put(path: string, data?: any, options?: RequestInit) {
      return tracedFetch(`${baseURL}${path}`, {
        ...options,
        method: 'PUT',
        body: JSON.stringify(data),
        headers: {
          'Content-Type': 'application/json',
          ...options?.headers,
        },
      })
    },

    async delete(path: string, options?: RequestInit) {
      return tracedFetch(`${baseURL}${path}`, {
        ...options,
        method: 'DELETE',
      })
    },
  }
}