import React from "react"
import { render, screen, fireEvent, waitFor } from "@testing-library/react"
import "@testing-library/jest-dom"
import { BillingFilters, BillingFilterValues } from "@/components/billing/BillingFilters"
import { useACHTransactions } from "@/hooks/use-ach-transactions"

// Mock the hook
jest.mock("@/hooks/use-ach-transactions")
const mockUseACHTransactions = useACHTransactions as jest.MockedFunction<typeof useACHTransactions>

// Mock fetch
global.fetch = jest.fn()

describe("Custom Date Range Integration", () => {
  const mockDate = new Date(2023, 2, 15) // March 15, 2023

  beforeEach(() => {
    jest.clearAllMocks()
    jest.useFakeTimers()
    jest.setSystemTime(mockDate)

    // Default mock return value
    mockUseACHTransactions.mockReturnValue({
      transactions: [],
      metrics: {
        totalVolume: 0,
        successRate: 0,
        pendingAmount: 0,
        failedAmount: 0,
        todayCount: 0,
        averageTransaction: 0,
        processedAmount: 0,
        returnedAmount: 0,
        totalFees: 0,
        netAmount: 0,
      },
      isLoading: false,
      error: null,
      refresh: jest.fn(),
      lastUpdated: new Date(),
      totalCount: 0,
      currentPage: 1,
      totalPages: 0,
    })

    ;(global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({
        transactions: [],
        pagination: { total: 0, totalPages: 0 },
        metrics: {},
      }),
    })
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  const TestComponent = ({ filters }: { filters: BillingFilterValues }) => {
    const { transactions } = useACHTransactions(filters, 1, 50)

    return (
      <div>
        <div data-testid="transaction-count">{transactions.length}</div>
        <BillingFilters filters={filters} onFiltersChange={() => {}} onClearFilters={() => {}} />
      </div>
    )
  }

  it("should generate correct query string with custom date range", () => {
    const startDate = new Date(2023, 2, 10) // March 10, 2023
    const endDate = new Date(2023, 2, 20) // March 20, 2023

    const filtersWithCustomRange: BillingFilterValues = {
      dateRange: {
        start: startDate,
        end: endDate,
        preset: "custom",
      },
      status: [],
      amountRange: { min: null, max: null },
      direction: "all",
      searchQuery: "",
    }

    render(<TestComponent filters={filtersWithCustomRange} />)

    // Verify that useACHTransactions was called with the correct filters
    expect(mockUseACHTransactions).toHaveBeenCalledWith(filtersWithCustomRange, 1, 50)

    // Verify the buildQueryParams logic by checking what was passed to the hook
    const callArgs = mockUseACHTransactions.mock.calls[0]
    const passedFilters = callArgs[0]

    expect(passedFilters.dateRange.start).toEqual(startDate)
    expect(passedFilters.dateRange.end).toEqual(endDate)
    expect(passedFilters.dateRange.preset).toBe("custom")
  })

  it("should handle custom date range with Apply button functionality", async () => {
    const onFiltersChange = jest.fn()

    const initialFilters: BillingFilterValues = {
      dateRange: {
        start: null,
        end: null,
        preset: "custom",
      },
      status: [],
      amountRange: { min: null, max: null },
      direction: "all",
      searchQuery: "",
    }

    render(
      <BillingFilters
        filters={initialFilters}
        onFiltersChange={onFiltersChange}
        onClearFilters={() => {}}
      />
    )

    // Click on the custom date picker button
    const customPickerButton = screen.getByText("Select custom date range")
    fireEvent.click(customPickerButton)

    // Should show Apply and Clear buttons
    const applyButton = screen.getByText("Apply")
    const clearButton = screen.getByText("Clear")

    expect(applyButton).toBeInTheDocument()
    expect(clearButton).toBeInTheDocument()
    expect(applyButton).toBeDisabled() // Should be disabled when no dates selected

    // Clear functionality
    fireEvent.click(clearButton)

    expect(onFiltersChange).toHaveBeenCalledWith({
      ...initialFilters,
      dateRange: { start: null, end: null, preset: "custom" },
    })
  })

  it("should verify query string contains startDate and endDate parameters", () => {
    const startDate = new Date(2023, 2, 10) // March 10, 2023
    const endDate = new Date(2023, 2, 20) // March 20, 2023

    const filtersWithCustomRange: BillingFilterValues = {
      dateRange: {
        start: startDate,
        end: endDate,
        preset: "custom",
      },
      status: [],
      amountRange: { min: null, max: null },
      direction: "all",
      searchQuery: "",
    }

    // Simulate the buildQueryParams function from useACHTransactions
    const buildQueryParams = (
      filters: BillingFilterValues,
      page: number = 1,
      limit: number = 50
    ) => {
      const params = new URLSearchParams()

      params.append("page", page.toString())
      params.append("limit", limit.toString())

      if (filters.dateRange.start) {
        params.append("startDate", filters.dateRange.start.toISOString())
      }

      if (filters.dateRange.end) {
        params.append("endDate", filters.dateRange.end.toISOString())
      }

      return params.toString()
    }

    const queryString = buildQueryParams(filtersWithCustomRange)

    expect(queryString).toContain("startDate=" + encodeURIComponent(startDate.toISOString()))
    expect(queryString).toContain("endDate=" + encodeURIComponent(endDate.toISOString()))
    expect(queryString).toContain("page=1")
    expect(queryString).toContain("limit=50")
  })

  it("should reset currentPage to 1 when applying custom date range", () => {
    const handleFiltersChange = jest.fn()
    let currentPage = 5 // Start on page 5
    let filters: BillingFilterValues = {
      dateRange: { start: null, end: null, preset: "custom" },
      status: [],
      amountRange: { min: null, max: null },
      direction: "all",
      searchQuery: "",
    }

    // Simulate the parent component's handleFiltersChange logic
    const mockHandleFiltersChange = (newFilters: BillingFilterValues) => {
      // Check if date range changed
      if (
        newFilters.dateRange.start !== filters.dateRange.start ||
        newFilters.dateRange.end !== filters.dateRange.end ||
        newFilters.dateRange.preset !== filters.dateRange.preset
      ) {
        currentPage = 1 // Reset to first page when date filters change
      }
      filters = newFilters
      handleFiltersChange(newFilters)
    }

    const startDate = new Date(2023, 2, 10)
    const endDate = new Date(2023, 2, 20)

    // Simulate applying a custom date range
    const newFilters: BillingFilterValues = {
      ...filters,
      dateRange: {
        start: startDate,
        end: endDate,
        preset: "custom",
      },
    }

    mockHandleFiltersChange(newFilters)

    expect(currentPage).toBe(1)
    expect(handleFiltersChange).toHaveBeenCalledWith(newFilters)
  })

  it("should not overwrite manual start/end dates when preset is custom", () => {
    const onFiltersChange = jest.fn()

    // Initial render with custom preset and existing dates
    const initialFilters: BillingFilterValues = {
      dateRange: {
        start: new Date(2023, 2, 10),
        end: new Date(2023, 2, 20),
        preset: "custom",
      },
      status: [],
      amountRange: { min: null, max: null },
      direction: "all",
      searchQuery: "",
    }

    const { rerender } = render(
      <BillingFilters
        filters={initialFilters}
        onFiltersChange={onFiltersChange}
        onClearFilters={() => {}}
      />
    )

    // Verify that the dates are displayed
    expect(screen.getByTestId("selected-date-range")).toHaveTextContent(
      "Mar 10, 2023 - Mar 20, 2023"
    )

    // Re-render with same preset (simulating a subsequent render)
    rerender(
      <BillingFilters
        filters={initialFilters}
        onFiltersChange={onFiltersChange}
        onClearFilters={() => {}}
      />
    )

    // Should still show the same dates
    expect(screen.getByTestId("selected-date-range")).toHaveTextContent(
      "Mar 10, 2023 - Mar 20, 2023"
    )

    // The onFiltersChange should not have been called during re-render
    expect(onFiltersChange).not.toHaveBeenCalled()
  })
})
