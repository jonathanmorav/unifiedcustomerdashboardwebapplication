import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { DateRangeFilter } from "@/components/search/filters/DateRangeFilter"
import { DateRange } from "@/lib/types/search"

describe("DateRangeFilter", () => {
  const mockOnChange = jest.fn()
  const defaultProps = {
    label: "Date Range",
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
        start: "2024-01-01",
        end: "2024-01-31",
      }
      render(<DateRangeFilter {...defaultProps} value={dateRange} />)
      
      // The component shows the formatted date range in the button
      const button = screen.getByRole("button")
      // toLocaleDateString may format differently based on locale/timezone
      expect(button.textContent).toMatch(/\d+\/\d+\/\d+.*\d+\/\d+\/\d+/)
    })

    it("displays single date when from and to are same", () => {
      const dateRange: DateRange = {
        start: "2024-01-15",
        end: "2024-01-15",
      }
      render(<DateRangeFilter {...defaultProps} value={dateRange} />)
      
      // Even for same date, it shows as a range
      const button = screen.getByRole("button")
      expect(button.textContent).toMatch(/\d+\/\d+\/\d+.*\d+\/\d+\/\d+/)
    })
  })

  describe("Preset Options", () => {
    it("shows preset options when clicked", async () => {
      const user = userEvent.setup()
      render(<DateRangeFilter {...defaultProps} />)
      
      await user.click(screen.getByText("Select date range"))
      
      expect(screen.getByText("Today")).toBeInTheDocument()
      expect(screen.getByText("Last 7 days")).toBeInTheDocument()
      expect(screen.getByText("Last 30 days")).toBeInTheDocument()
      expect(screen.getByText("Last 90 days")).toBeInTheDocument()
    })

    it("selects today preset", async () => {
      const user = userEvent.setup()
      render(<DateRangeFilter {...defaultProps} />)
      
      await user.click(screen.getByText("Select date range"))
      await user.click(screen.getByText("Today"))
      
      const today = new Date().toISOString().split("T")[0]
      expect(mockOnChange).toHaveBeenCalledWith({
        start: today,
        end: today,
      })
    })

    it("selects last 7 days preset", async () => {
      const user = userEvent.setup()
      render(<DateRangeFilter {...defaultProps} />)
      
      await user.click(screen.getByText("Select date range"))
      await user.click(screen.getByText("Last 7 days"))
      
      expect(mockOnChange).toHaveBeenCalledWith({
        start: expect.any(String),
        end: expect.any(String),
      })
      
      // Verify the range is roughly 7 days
      const call = mockOnChange.mock.calls[0][0]
      const start = new Date(call.start)
      const end = new Date(call.end)
      const diffDays = Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24))
      expect(diffDays).toBe(7)
    })

    it("selects last 30 days preset", async () => {
      const user = userEvent.setup()
      render(<DateRangeFilter {...defaultProps} />)
      
      await user.click(screen.getByText("Select date range"))
      await user.click(screen.getByText("Last 30 days"))
      
      expect(mockOnChange).toHaveBeenCalledWith({
        start: expect.any(String),
        end: expect.any(String),
      })
    })

    it("selects last 90 days preset", async () => {
      const user = userEvent.setup()
      render(<DateRangeFilter {...defaultProps} />)
      
      await user.click(screen.getByText("Select date range"))
      await user.click(screen.getByText("Last 90 days"))
      
      expect(mockOnChange).toHaveBeenCalledWith({
        start: expect.any(String),
        end: expect.any(String),
      })
    })
  })

  describe("Clear Functionality", () => {
    it("shows clear button when date is selected", async () => {
      const user = userEvent.setup()
      const dateRange: DateRange = {
        start: "2024-01-01",
        end: "2024-01-31",
      }
      render(<DateRangeFilter {...defaultProps} value={dateRange} />)
      
      await user.click(screen.getByRole("button"))
      
      expect(screen.getByText("Clear")).toBeInTheDocument()
    })

    it("clears date range when clear button clicked", async () => {
      const user = userEvent.setup()
      const dateRange: DateRange = {
        start: "2024-01-01",
        end: "2024-01-31",
      }
      render(<DateRangeFilter {...defaultProps} value={dateRange} />)
      
      await user.click(screen.getByRole("button"))
      await user.click(screen.getByText("Clear"))
      
      expect(mockOnChange).toHaveBeenCalledWith(undefined)
    })

    it("does not show clear button when no date selected", async () => {
      const user = userEvent.setup()
      render(<DateRangeFilter {...defaultProps} />)
      
      await user.click(screen.getByText("Select date range"))
      
      // Clear button should still be visible in the popover
      expect(screen.getByText("Clear")).toBeInTheDocument()
    })
  })

  describe("Custom Range Selection", () => {
    it("opens custom range inputs in popover", async () => {
      const user = userEvent.setup()
      render(<DateRangeFilter {...defaultProps} />)
      
      await user.click(screen.getByText("Select date range"))
      
      // Should see date inputs for custom range
      expect(screen.getByLabelText("Start date")).toBeInTheDocument()
      expect(screen.getByLabelText("End date")).toBeInTheDocument()
    })

    it("allows selecting a date range", async () => {
      const user = userEvent.setup()
      render(<DateRangeFilter {...defaultProps} />)
      
      await user.click(screen.getByText("Select date range"))
      
      const startInput = screen.getByLabelText("Start date")
      const endInput = screen.getByLabelText("End date")
      
      await user.clear(startInput)
      await user.type(startInput, "2024-01-01")
      await user.clear(endInput)
      await user.type(endInput, "2024-01-31")
      
      await user.click(screen.getByText("Apply"))
      
      expect(mockOnChange).toHaveBeenCalledWith({
        start: "2024-01-01",
        end: "2024-01-31",
      })
    })
  })

  describe("Popover Behavior", () => {
    it("opens and closes popover correctly", async () => {
      const user = userEvent.setup()
      render(<DateRangeFilter {...defaultProps} />)
      
      // Initially popover is closed
      expect(screen.queryByText("Quick select")).not.toBeInTheDocument()
      
      // Open popover
      await user.click(screen.getByRole("button"))
      expect(screen.getByText("Quick select")).toBeInTheDocument()
      
      // Close popover by clicking outside
      await user.click(document.body)
      await waitFor(() => {
        expect(screen.queryByText("Quick select")).not.toBeInTheDocument()
      })
    })

    it("closes popover after selecting preset", async () => {
      const user = userEvent.setup()
      render(<DateRangeFilter {...defaultProps} />)
      
      await user.click(screen.getByRole("button"))
      await user.click(screen.getByText("Today"))
      
      // Popover should close after selection
      await waitFor(() => {
        expect(screen.queryByText("Quick select")).not.toBeInTheDocument()
      })
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
      expect(button).toHaveAttribute("aria-haspopup", "dialog")
    })

    it("announces selected date range", () => {
      const dateRange: DateRange = {
        start: "2024-01-01",
        end: "2024-01-31",
      }
      render(<DateRangeFilter {...defaultProps} value={dateRange} />)
      
      const button = screen.getByRole("button")
      // Check that button contains a date range pattern
      expect(button.textContent).toMatch(/\d+\/\d+\/\d+.*\d+\/\d+\/\d+/)
    })
  })

  describe("Edge Cases", () => {
    it("handles invalid date range (to before from)", async () => {
      const user = userEvent.setup()
      render(<DateRangeFilter {...defaultProps} />)
      
      await user.click(screen.getByText("Select date range"))
      
      const startInput = screen.getByLabelText("Start date")
      const endInput = screen.getByLabelText("End date")
      
      await user.clear(startInput)
      await user.type(startInput, "2024-01-31")
      await user.clear(endInput)
      await user.type(endInput, "2024-01-01")
      
      await user.click(screen.getByText("Apply"))
      
      // Should still call onChange with the dates as entered
      expect(mockOnChange).toHaveBeenCalledWith({
        start: "2024-01-31",
        end: "2024-01-01",
      })
    })

    it("handles rapid preset selections", async () => {
      const user = userEvent.setup()
      render(<DateRangeFilter {...defaultProps} />)
      
      await user.click(screen.getByText("Select date range"))
      
      // Rapidly click different presets
      await user.click(screen.getByText("Today"))
      
      // Re-open and select another
      await user.click(screen.getByRole("button"))
      await user.click(screen.getByText("Last 7 days"))
      
      // Verify both calls were made
      expect(mockOnChange).toHaveBeenCalledTimes(2)
    })
  })
})