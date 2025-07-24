import React from "react"
import { render, screen, fireEvent } from "@testing-library/react"
import "@testing-library/jest-dom"
import { BillingFilters, BillingFilterValues } from "@/components/billing/BillingFilters"
import { format, startOfDay, endOfDay, startOfWeek, endOfWeek } from "date-fns"

// Mock the date to ensure consistent test results
const mockDate = new Date(2023, 2, 15, 14, 30, 0, 0) // Wednesday, March 15, 2023, 14:30:00
jest.useFakeTimers()
jest.setSystemTime(mockDate)

describe("BillingFilters", () => {
  const defaultFilters: BillingFilterValues = {
    dateRange: {
      start: null,
      end: null,
      preset: undefined,
    },
    status: [],
    amountRange: {
      min: null,
      max: null,
    },
    direction: "all",
    searchQuery: "",
  }

  const mockOnFiltersChange = jest.fn()
  const mockOnClearFilters = jest.fn()

  beforeEach(() => {
    jest.clearAllMocks()
  })

  afterAll(() => {
    jest.useRealTimers()
  })

  it("should render without crashing", () => {
    render(
      <BillingFilters
        filters={defaultFilters}
        onFiltersChange={mockOnFiltersChange}
        onClearFilters={mockOnClearFilters}
      />
    )

    expect(screen.getByText("Filters")).toBeInTheDocument()
    expect(screen.getByText("Date Range")).toBeInTheDocument()
  })

  it("should handle today preset correctly", () => {
    render(
      <BillingFilters
        filters={defaultFilters}
        onFiltersChange={mockOnFiltersChange}
        onClearFilters={mockOnClearFilters}
      />
    )

    // Find the Date Range section and get the first combobox (the date range select)
    const dateRangeSection = screen.getByText("Date Range").closest("div")
    const dateRangeSelect = dateRangeSection?.querySelector('[role="combobox"]')
    expect(dateRangeSelect).toBeInTheDocument()
    fireEvent.click(dateRangeSelect!)

    // Select 'Today' option
    const todayOption = screen.getByText("Today")
    fireEvent.click(todayOption)

    expect(mockOnFiltersChange).toHaveBeenCalledWith({
      ...defaultFilters,
      dateRange: {
        start: startOfDay(mockDate),
        end: endOfDay(mockDate),
        preset: "today",
      },
    })
  })

  it("should handle week preset correctly with Sunday start", () => {
    render(
      <BillingFilters
        filters={defaultFilters}
        onFiltersChange={mockOnFiltersChange}
        onClearFilters={mockOnClearFilters}
      />
    )

    // Find the Date Range section and get the first combobox (the date range select)
    const dateRangeSection = screen.getByText("Date Range").closest("div")
    const dateRangeSelect = dateRangeSection?.querySelector('[role="combobox"]')
    expect(dateRangeSelect).toBeInTheDocument()
    fireEvent.click(dateRangeSelect!)

    // Select 'This Week' option
    const weekOption = screen.getByText("This Week")
    fireEvent.click(weekOption)

    expect(mockOnFiltersChange).toHaveBeenCalledWith({
      ...defaultFilters,
      dateRange: {
        start: startOfWeek(mockDate, { weekStartsOn: 0 }),
        end: endOfWeek(mockDate, { weekStartsOn: 0 }),
        preset: "week",
      },
    })

    // Verify that the returned dates are what we expect
    const lastCall = mockOnFiltersChange.mock.calls[mockOnFiltersChange.mock.calls.length - 1]
    const { start, end } = lastCall[0].dateRange

    // March 15, 2023 is a Wednesday
    // Week should start on Sunday March 12, 2023 and end on Saturday March 18, 2023
    expect(format(start, "yyyy-MM-dd")).toBe("2023-03-12")
    expect(format(end, "yyyy-MM-dd")).toBe("2023-03-18")
    expect(start.getDay()).toBe(0) // Sunday
    expect(end.getDay()).toBe(6) // Saturday
  })

  it("should create new Date instances and not mutate input dates", () => {
    const originalMockDate = new Date(mockDate)

    render(
      <BillingFilters
        filters={defaultFilters}
        onFiltersChange={mockOnFiltersChange}
        onClearFilters={mockOnClearFilters}
      />
    )

    // Find the Date Range section and get the first combobox (the date range select)
    const dateRangeSection = screen.getByText("Date Range").closest("div")
    const dateRangeSelect = dateRangeSection?.querySelector('[role="combobox"]')
    expect(dateRangeSelect).toBeInTheDocument()
    fireEvent.click(dateRangeSelect!)

    // Select 'Today' option
    const todayOption = screen.getByText("Today")
    fireEvent.click(todayOption)

    // Verify the mock date hasn't been mutated
    expect(mockDate).toEqual(originalMockDate)

    // Verify the returned dates are different instances
    const lastCall = mockOnFiltersChange.mock.calls[mockOnFiltersChange.mock.calls.length - 1]
    const { start, end } = lastCall[0].dateRange

    expect(start).not.toBe(mockDate)
    expect(end).not.toBe(mockDate)
    expect(start).not.toBe(end)
  })

  it("should display formatted date range when dates are selected", () => {
    const filtersWithDate: BillingFilterValues = {
      ...defaultFilters,
      dateRange: {
        start: startOfDay(mockDate),
        end: endOfDay(mockDate),
        preset: "today",
      },
    }

    render(
      <BillingFilters
        filters={filtersWithDate}
        onFiltersChange={mockOnFiltersChange}
        onClearFilters={mockOnClearFilters}
      />
    )

    // Should display the formatted date range
    expect(screen.getByText("Mar 15, 2023 - Mar 15, 2023")).toBeInTheDocument()
  })

  it("should handle custom preset by preserving existing dates", () => {
    const filtersWithExistingDates: BillingFilterValues = {
      ...defaultFilters,
      dateRange: {
        start: startOfDay(mockDate),
        end: endOfDay(mockDate),
        preset: "today",
      },
    }

    render(
      <BillingFilters
        filters={filtersWithExistingDates}
        onFiltersChange={mockOnFiltersChange}
        onClearFilters={mockOnClearFilters}
      />
    )

    // Find the Date Range section and get the first combobox (the date range select)
    const dateRangeSection = screen.getByText("Date Range").closest("div")
    const dateRangeSelect = dateRangeSection?.querySelector('[role="combobox"]')
    expect(dateRangeSelect).toBeInTheDocument()
    fireEvent.click(dateRangeSelect!)

    // Select 'Custom Range' option from dropdown
    const customOptions = screen.getAllByText("Custom Range")
    const customOption = customOptions.find((el) => el.closest('[role="option"]'))
    expect(customOption).toBeInTheDocument()
    fireEvent.click(customOption!)

    // Should preserve existing dates when switching to custom
    expect(mockOnFiltersChange).toHaveBeenCalledWith({
      ...filtersWithExistingDates,
      dateRange: {
        start: startOfDay(mockDate),
        end: endOfDay(mockDate),
        preset: "custom",
      },
    })
  })

  it("should show custom date picker when custom preset is selected", () => {
    const filtersWithCustom: BillingFilterValues = {
      ...defaultFilters,
      dateRange: {
        start: null,
        end: null,
        preset: "custom",
      },
    }

    render(
      <BillingFilters
        filters={filtersWithCustom}
        onFiltersChange={mockOnFiltersChange}
        onClearFilters={mockOnClearFilters}
      />
    )

    // Should show the custom date picker button
    expect(screen.getByText("Select custom date range")).toBeInTheDocument()
  })

  it("should open calendar popover when custom date picker button is clicked", () => {
    const filtersWithCustom: BillingFilterValues = {
      ...defaultFilters,
      dateRange: {
        start: null,
        end: null,
        preset: "custom",
      },
    }

    render(
      <BillingFilters
        filters={filtersWithCustom}
        onFiltersChange={mockOnFiltersChange}
        onClearFilters={mockOnClearFilters}
      />
    )

    const customPickerButton = screen.getByText("Select custom date range")
    fireEvent.click(customPickerButton)

    // Should show Apply and Clear buttons
    expect(screen.getByText("Apply")).toBeInTheDocument()
    expect(screen.getByText("Clear")).toBeInTheDocument()
  })

  it("should disable Apply button when both dates are not selected", () => {
    const filtersWithCustom: BillingFilterValues = {
      ...defaultFilters,
      dateRange: {
        start: null,
        end: null,
        preset: "custom",
      },
    }

    render(
      <BillingFilters
        filters={filtersWithCustom}
        onFiltersChange={mockOnFiltersChange}
        onClearFilters={mockOnClearFilters}
      />
    )

    const customPickerButton = screen.getByText("Select custom date range")
    fireEvent.click(customPickerButton)

    const applyButton = screen.getByText("Apply")
    expect(applyButton).toBeDisabled()
  })

  it("should not overwrite manual dates when preset is custom on subsequent renders", () => {
    const initialProps = {
      filters: {
        ...defaultFilters,
        dateRange: {
          start: startOfDay(mockDate),
          end: endOfDay(mockDate),
          preset: "custom" as const,
        },
      },
      onFiltersChange: mockOnFiltersChange,
      onClearFilters: mockOnClearFilters,
    }

    const { rerender } = render(<BillingFilters {...initialProps} />)

    // Verify initial state using the specific test-id
    expect(screen.getByTestId("selected-date-range")).toHaveTextContent(
      "Mar 15, 2023 - Mar 15, 2023"
    )

    // Re-render with the same custom preset - should not change the dates
    const newDate = new Date(2023, 3, 20) // April 20, 2023
    const updatedProps = {
      ...initialProps,
      filters: {
        ...initialProps.filters,
        dateRange: {
          start: startOfDay(newDate),
          end: endOfDay(newDate),
          preset: "custom" as const,
        },
      },
    }

    rerender(<BillingFilters {...updatedProps} />)

    // Should show the new dates from props
    expect(screen.getByTestId("selected-date-range")).toHaveTextContent(
      "Apr 20, 2023 - Apr 20, 2023"
    )
  })

  it("should show active filter count when date range is set", () => {
    const filtersWithDate: BillingFilterValues = {
      ...defaultFilters,
      dateRange: {
        start: startOfDay(mockDate),
        end: endOfDay(mockDate),
        preset: "today",
      },
    }

    render(
      <BillingFilters
        filters={filtersWithDate}
        onFiltersChange={mockOnFiltersChange}
        onClearFilters={mockOnClearFilters}
      />
    )

    // Should show filter count badge
    expect(screen.getByText("1")).toBeInTheDocument()
    expect(screen.getByText("Clear All")).toBeInTheDocument()
  })
})
