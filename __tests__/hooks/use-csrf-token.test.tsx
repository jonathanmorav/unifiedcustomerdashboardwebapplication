import { renderHook, waitFor } from "@testing-library/react"
import { useCSRFToken } from "@/lib/hooks/use-csrf-token"
import { useSession } from "next-auth/react"

// Mock fetch
global.fetch = jest.fn()

// Mock next-auth
jest.mock("next-auth/react", () => ({
  useSession: jest.fn(),
}))

describe("useCSRFToken", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    // Mock session by default
    ;(useSession as jest.Mock).mockReturnValue({
      data: { user: { email: "test@example.com" } },
      status: "authenticated",
    })
  })

  it("should fetch CSRF token on mount", async () => {
    const mockToken = {
      token: "test-csrf-token",
      expiresAt: Date.now() + 3600000,
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
      expect(result.current.token).toBe(mockToken.token)
    })

    expect(global.fetch).toHaveBeenCalledWith("/api/auth/csrf", {
      method: "GET",
      credentials: "include",
    })
  })

  it("should handle fetch errors", async () => {
    ;(global.fetch as jest.Mock).mockRejectedValueOnce(new Error("Network error"))

    const { result } = renderHook(() => useCSRFToken())

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
      expect(result.current.error).toBeInstanceOf(Error)
      expect(result.current.error?.message).toBe("Network error")
      expect(result.current.token).toBeNull()
    })
  })

  it("should not fetch token when no session", async () => {
    ;(useSession as jest.Mock).mockReturnValue({
      data: null,
      status: "unauthenticated",
    })

    const { result } = renderHook(() => useCSRFToken())

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
      expect(result.current.token).toBeNull()
    })

    expect(global.fetch).not.toHaveBeenCalled()
  })

  it("should handle non-ok response", async () => {
    ;(global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: false,
      status: 403,
    })

    const { result } = renderHook(() => useCSRFToken())

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
      expect(result.current.error).toBeInstanceOf(Error)
      expect(result.current.error?.message).toBe("Failed to fetch CSRF token")
      expect(result.current.token).toBeNull()
    })
  })
})
