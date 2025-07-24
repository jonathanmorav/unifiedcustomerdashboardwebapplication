import { useEffect, useState } from "react"
import { useSession } from "next-auth/react"

export interface CSRFTokenResponse {
  token: string
  expiresAt: number
}

export function useCSRFToken() {
  const { data: session } = useSession()
  const [token, setToken] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  useEffect(() => {
    if (!session) {
      setLoading(false)
      return
    }

    const fetchToken = async () => {
      try {
        const response = await fetch("/api/auth/csrf", {
          method: "GET",
          credentials: "include",
        })

        if (!response.ok) {
          throw new Error("Failed to fetch CSRF token")
        }

        const data: CSRFTokenResponse = await response.json()
        setToken(data.token)
        setError(null)

        // Set up automatic refresh before expiry
        const timeUntilExpiry = data.expiresAt - Date.now()
        const refreshTime = Math.max(timeUntilExpiry - 60000, 0) // Refresh 1 minute before expiry

        if (refreshTime > 0) {
          const timeout = setTimeout(fetchToken, refreshTime)
          return () => clearTimeout(timeout)
        }
      } catch (err) {
        setError(err instanceof Error ? err : new Error("Unknown error"))
        setToken(null)
      } finally {
        setLoading(false)
      }
    }

    fetchToken()
  }, [session])

  const refreshToken = async () => {
    setLoading(true)
    setError(null)

    try {
      const response = await fetch("/api/auth/csrf", {
        method: "POST",
        credentials: "include",
      })

      if (!response.ok) {
        throw new Error("Failed to refresh CSRF token")
      }

      const data: CSRFTokenResponse = await response.json()
      setToken(data.token)
    } catch (err) {
      setError(err instanceof Error ? err : new Error("Unknown error"))
      setToken(null)
    } finally {
      setLoading(false)
    }
  }

  return {
    token,
    loading,
    error,
    refreshToken,
  }
}

/**
 * Helper function to add CSRF token to fetch requests
 */
export function fetchWithCSRF(
  url: string,
  options: RequestInit & { csrfToken: string }
): Promise<Response> {
  const { csrfToken, ...fetchOptions } = options

  return fetch(url, {
    ...fetchOptions,
    headers: {
      ...fetchOptions.headers,
      "X-CSRF-Token": csrfToken,
    },
  })
}

/**
 * Helper function for API clients to sign requests
 */
export async function fetchWithAPISignature(
  url: string,
  options: RequestInit & { apiKey: string }
): Promise<Response> {
  const { apiKey, ...fetchOptions } = options
  const method = fetchOptions.method || "GET"
  const timestamp = Date.now().toString()

  // Calculate body hash if present
  let bodyHash: string | undefined
  if (fetchOptions.body) {
    const encoder = new TextEncoder()
    const data = encoder.encode(
      typeof fetchOptions.body === "string" ? fetchOptions.body : JSON.stringify(fetchOptions.body)
    )
    const hashBuffer = await crypto.subtle.digest("SHA-256", data)
    bodyHash = Array.from(new Uint8Array(hashBuffer))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("")
  }

  // Create signature
  const path = new URL(url).pathname
  const payload = `${method}:${path}:${timestamp}:${bodyHash || ""}`

  const encoder = new TextEncoder()
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(apiKey),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  )

  const signatureBuffer = await crypto.subtle.sign("HMAC", key, encoder.encode(payload))

  const signature = Array.from(new Uint8Array(signatureBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")

  return fetch(url, {
    ...fetchOptions,
    headers: {
      ...fetchOptions.headers,
      "X-API-Key": apiKey,
      "X-Request-Signature": signature,
      "X-Timestamp": timestamp,
      ...(bodyHash ? { "X-Body-Hash": bodyHash } : {}),
    },
  })
}
