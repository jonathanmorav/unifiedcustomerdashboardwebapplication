import { renderHook, waitFor } from "@testing-library/react"
import { useCSRFToken } from "@/lib/hooks/use-csrf-token"

// Mock fetch
global.fetch = jest.fn()

describe("useCSRFToken", () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it("should fetch CSRF token on mount", async () => {
    const mockToken = {
      token: "test-token",
      csrfToken: "test-csrf-token",
      expiry: Date.now() + 3600000,
    }

    ;(global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => mockToken,
    })

    const { result } = renderHook(() => useCSRFToken())

    // Initially loading
    expect(result.current.loading).toBe(true)
    expect(result.current.token).toBeNull()

    // Wait for token to be fetched
    await waitFor(() => {
      expect(result.current.loading).toBe(false)
      expect(result.current.token).toBe(mockToken.csrfToken)
    })

    expect(global.fetch).toHaveBeenCalledWith("/api/auth/csrf")
  })

  it("should handle fetch errors", async () => {
    ;(global.fetch as jest.Mock).mockRejectedValueOnce(new Error("Network error"))

    const { result } = renderHook(() => useCSRFToken())

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
      expect(result.current.error).toBe("Failed to fetch CSRF token")
      expect(result.current.token).toBeNull()
    })
  })

  it("should refresh token when it expires", async () => {
    const expiredToken = {
      token: "expired-token",
      csrfToken: "expired-csrf-token",
      expiry: Date.now() - 1000, // Already expired
    }

    const newToken = {
      token: "new-token",
      csrfToken: "new-csrf-token",
      expiry: Date.now() + 3600000,
    }

    ;(global.fetch as jest.Mock)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => expiredToken,
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => newToken,
      })

    const { result } = renderHook(() => useCSRFToken())

    await waitFor(() => {
      expect(result.current.token).toBe(newToken.csrfToken)
    })

    // Should have fetched twice - initial and refresh
    expect(global.fetch).toHaveBeenCalledTimes(2)
  })
})
