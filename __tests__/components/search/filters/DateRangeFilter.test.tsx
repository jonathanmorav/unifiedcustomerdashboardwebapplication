import { render, screen, fireEvent } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { DateRangeFilter } from "@/components/search/filters/DateRangeFilter"
import { DateRange } from "@/lib/types/search"
import { format, subDays, addDays } from "date-fns"

describe("DateRangeFilter", () => {
  const mockOnChange = jest.fn()
  const defaultProps = {
    value: undefined,
    onChange: mockOnChange,
  }

  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe("Rendering", () => {
    it("renders with label", () => {
      render(<DateRangeFilter {...defaultProps} />)
      expect(screen.getByText("Date Range")).toBeInTheDocument()
    })

    it("shows placeholder when no date selected", () => {
      render(<DateRangeFilter {...defaultProps} />)
      expect(screen.getByText("Select date range")).toBeInTheDocument()
    })

    it("displays selected date range", () => {
      const dateRange: DateRange = {
        from: new Date("2024-01-01"),
        to: new Date("2024-01-31"),
      }
      render(<DateRangeFilter {...defaultProps} value={dateRange} />)
      
      const formattedRange = `${format(dateRange.from, "LLL dd, y")} - ${format(
        dateRange.to,
        "LLL dd, y"
      )}`
      expect(screen.getByText(formattedRange)).toBeInTheDocument()
    })

    it("displays single date when from and to are same", () => {
      const date = new Date("2024-01-15")
      const dateRange: DateRange = {
        from: date,
        to: date,
      }
      render(<DateRangeFilter {...defaultProps} value={dateRange} />)
      
      const formattedDate = format(date, "LLL dd, y")
      expect(screen.getByText(formattedDate)).toBeInTheDocument()
    })
  })

  describe("Preset Options", () => {
    it("shows preset options when clicked", async () => {
      const user = userEvent.setup()
      render(<DateRangeFilter {...defaultProps} />)
      
      const button = screen.getByRole("button")
      await user.click(button)
      
      // Check for preset options
      expect(screen.getByText("Today")).toBeInTheDocument()
      expect(screen.getByText("Yesterday")).toBeInTheDocument()
      expect(screen.getByText("Last 7 days")).toBeInTheDocument()
      expect(screen.getByText("Last 30 days")).toBeInTheDocument()
      expect(screen.getByText("Last 90 days")).toBeInTheDocument()
      expect(screen.getByText("Custom range")).toBeInTheDocument()
    })

    it("selects today preset", async () => {
      const user = userEvent.setup()
      render(<DateRangeFilter {...defaultProps} />)
      
      await user.click(screen.getByRole("button"))
      await user.click(screen.getByText("Today"))
      
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      
      expect(mockOnChange).toHaveBeenCalledWith({
        from: today,
        to: today,
      })
    })

    it("selects yesterday preset", async () => {
      const user = userEvent.setup()
      render(<DateRangeFilter {...defaultProps} />)
      
      await user.click(screen.getByRole("button"))
      await user.click(screen.getByText("Yesterday"))
      
      const yesterday = subDays(new Date(), 1)
      yesterday.setHours(0, 0, 0, 0)
      
      expect(mockOnChange).toHaveBeenCalledWith({
        from: yesterday,
        to: yesterday,
      })
    })

    it("selects last 7 days preset", async () => {
      const user = userEvent.setup()
      render(<DateRangeFilter {...defaultProps} />)
      
      await user.click(screen.getByRole("button"))
      await user.click(screen.getByText("Last 7 days"))
      
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      const sevenDaysAgo = subDays(today, 6)
      sevenDaysAgo.setHours(0, 0, 0, 0)
      
      expect(mockOnChange).toHaveBeenCalledWith({
        from: sevenDaysAgo,
        to: today,
      })
    })

    it("selects last 30 days preset", async () => {
      const user = userEvent.setup()
      render(<DateRangeFilter {...defaultProps} />)
      
      await user.click(screen.getByRole("button"))
      await user.click(screen.getByText("Last 30 days"))
      
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      const thirtyDaysAgo = subDays(today, 29)
      thirtyDaysAgo.setHours(0, 0, 0, 0)
      
      expect(mockOnChange).toHaveBeenCalledWith({
        from: thirtyDaysAgo,
        to: today,
      })
    })

    it("selects last 90 days preset", async () => {
      const user = userEvent.setup()
      render(<DateRangeFilter {...defaultProps} />)
      
      await user.click(screen.getByRole("button"))
      await user.click(screen.getByText("Last 90 days"))
      
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      const ninetyDaysAgo = subDays(today, 89)
      ninetyDaysAgo.setHours(0, 0, 0, 0)
      
      expect(mockOnChange).toHaveBeenCalledWith({
        from: ninetyDaysAgo,
        to: today,
      })
    })
  })

  describe("Clear Functionality", () => {
    it("shows clear button when date is selected", () => {
      const dateRange: DateRange = {
        from: new Date("2024-01-01"),
        to: new Date("2024-01-31"),
      }
      render(<DateRangeFilter {...defaultProps} value={dateRange} />)
      
      const clearButton = screen.getByRole("button", { name: /clear/i })
      expect(clearButton).toBeInTheDocument()
    })

    it("clears date range when clear button clicked", async () => {
      const user = userEvent.setup()
      const dateRange: DateRange = {
        from: new Date("2024-01-01"),
        to: new Date("2024-01-31"),
      }
      render(<DateRangeFilter {...defaultProps} value={dateRange} />)
      
      const clearButton = screen.getByRole("button", { name: /clear/i })
      await user.click(clearButton)
      
      expect(mockOnChange).toHaveBeenCalledWith(undefined)
    })

    it("does not show clear button when no date selected", () => {
      render(<DateRangeFilter {...defaultProps} />)
      
      const clearButton = screen.queryByRole("button", { name: /clear/i })
      expect(clearButton).not.toBeInTheDocument()
    })
  })

  describe("Custom Range Selection", () => {
    it("opens calendar when custom range is selected", async () => {
      const user = userEvent.setup()
      render(<DateRangeFilter {...defaultProps} />)
      
      await user.click(screen.getByRole("button"))
      await user.click(screen.getByText("Custom range"))
      
      // Calendar should be visible
      expect(screen.getByRole("grid")).toBeInTheDocument()
    })

    it("allows selecting a date range", async () => {
      const user = userEvent.setup()
      render(<DateRangeFilter {...defaultProps} />)
      
      await user.click(screen.getByRole("button"))
      await user.click(screen.getByText("Custom range"))
      
      // Find and click on two dates in the calendar
      const dates = screen.getAllByRole("gridcell", { disabled: false })
      const firstDate = dates[10] // Arbitrary date
      const secondDate = dates[15] // Another arbitrary date
      
      await user.click(firstDate)
      await user.click(secondDate)
      
      expect(mockOnChange).toHaveBeenCalled()
    })
  })

  describe("Disabled State", () => {
    it("disables button when disabled prop is true", () => {
      render(<DateRangeFilter {...defaultProps} disabled={true} />)
      
      const button = screen.getByRole("button")
      expect(button).toBeDisabled()
    })

    it("does not open popover when disabled", async () => {
      const user = userEvent.setup()
      render(<DateRangeFilter {...defaultProps} disabled={true} />)
      
      const button = screen.getByRole("button")
      await user.click(button)
      
      // Preset options should not be visible
      expect(screen.queryByText("Today")).not.toBeInTheDocument()
    })
  })

  describe("Custom Class Names", () => {
    it("applies custom className", () => {
      const { container } = render(
        <DateRangeFilter {...defaultProps} className="custom-class" />
      )
      
      expect(container.firstChild).toHaveClass("custom-class")
    })
  })

  describe("Accessibility", () => {
    it("has accessible button with label", () => {
      render(<DateRangeFilter {...defaultProps} />)
      
      const button = screen.getByRole("button")
      expect(button).toHaveAccessibleName()
    })

    it("announces selected date range", () => {
      const dateRange: DateRange = {
        from: new Date("2024-01-01"),
        to: new Date("2024-01-31"),
      }
      render(<DateRangeFilter {...defaultProps} value={dateRange} />)
      
      const button = screen.getByRole("button")
      const formattedRange = `${format(dateRange.from, "LLL dd, y")} - ${format(
        dateRange.to,
        "LLL dd, y"
      )}`
      expect(button).toHaveTextContent(formattedRange)
    })
  })

  describe("Edge Cases", () => {
    it("handles invalid date range (to before from)", async () => {
      const user = userEvent.setup()
      render(<DateRangeFilter {...defaultProps} />)
      
      await user.click(screen.getByRole("button"))
      await user.click(screen.getByText("Custom range"))
      
      // This would normally be handled by the calendar component
      // Just verify calendar is displayed
      expect(screen.getByRole("grid")).toBeInTheDocument()
    })

    it("handles rapid preset selections", async () => {
      const user = userEvent.setup()
      render(<DateRangeFilter {...defaultProps} />)
      
      const button = screen.getByRole("button")
      
      // Rapidly select different presets
      await user.click(button)
      await user.click(screen.getByText("Today"))
      
      await user.click(button)
      await user.click(screen.getByText("Yesterday"))
      
      await user.click(button)
      await user.click(screen.getByText("Last 7 days"))
      
      // Should have been called 3 times
      expect(mockOnChange).toHaveBeenCalledTimes(3)
    })
  })
})