import { render, screen, fireEvent, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { AmountRangeFilter } from "@/components/search/filters/AmountRangeFilter"
import { AmountRange } from "@/lib/types/search"

describe("AmountRangeFilter", () => {
  const mockOnChange = jest.fn()
  const defaultProps = {
    label: "Amount Range",
    value: undefined,
    onChange: mockOnChange,
  }

  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe("Rendering", () => {
    it("renders with label", () => {
      render(<AmountRangeFilter {...defaultProps} />)
      expect(screen.getByText("Amount Range")).toBeInTheDocument()
    })

    it("shows placeholder text when no value", () => {
      render(<AmountRangeFilter {...defaultProps} />)
      expect(screen.getByText("Select amount range")).toBeInTheDocument()
    })

    it("displays selected amount range", () => {
      const amountRange: AmountRange = {
        min: 1000,
        max: 5000,
        currency: "USD"
      }
      render(<AmountRangeFilter {...defaultProps} value={amountRange} />)
      expect(screen.getByText("$1,000 - $5,000")).toBeInTheDocument()
    })

    it("shows currency symbol", () => {
      render(<AmountRangeFilter {...defaultProps} />)
      expect(screen.getByRole("button")).toBeInTheDocument()
      const button = screen.getByRole("button")
      expect(button.querySelector("svg")).toBeInTheDocument() // DollarSign icon
    })
  })

  describe("Popover Interaction", () => {
    it("opens popover when button is clicked", async () => {
      const user = userEvent.setup()
      render(<AmountRangeFilter {...defaultProps} />)
      
      const button = screen.getByText("Select amount range")
      await user.click(button)
      
      expect(screen.getByText("Quick select")).toBeInTheDocument()
      expect(screen.getByText("Custom range")).toBeInTheDocument()
    })

    it("shows preset ranges in popover", async () => {
      const user = userEvent.setup()
      render(<AmountRangeFilter {...defaultProps} />)
      
      const button = screen.getByText("Select amount range")
      await user.click(button)
      
      expect(screen.getByText("Under $100")).toBeInTheDocument()
      expect(screen.getByText("$100 - $500")).toBeInTheDocument()
      expect(screen.getByText("$500 - $1,000")).toBeInTheDocument()
      expect(screen.getByText("$1,000 - $5,000")).toBeInTheDocument()
    })
  })

  describe("Preset Selection", () => {
    it("selects preset range when clicked", async () => {
      const user = userEvent.setup()
      render(<AmountRangeFilter {...defaultProps} />)
      
      await user.click(screen.getByText("Select amount range"))
      await user.click(screen.getByText("$100 - $500"))
      
      expect(mockOnChange).toHaveBeenCalledWith({
        min: 100,
        max: 500,
        currency: "USD"
      })
    })

    it("closes popover after preset selection", async () => {
      const user = userEvent.setup()
      render(<AmountRangeFilter {...defaultProps} />)
      
      await user.click(screen.getByText("Select amount range"))
      await user.click(screen.getByText("Under $100"))
      
      await waitFor(() => {
        expect(screen.queryByText("Quick select")).not.toBeInTheDocument()
      })
    })
  })

  describe("Custom Range Input", () => {
    it("allows custom min/max input", async () => {
      const user = userEvent.setup()
      render(<AmountRangeFilter {...defaultProps} />)
      
      await user.click(screen.getByText("Select amount range"))
      
      const minInput = screen.getByLabelText("Min amount")
      const maxInput = screen.getByLabelText("Max amount")
      
      await user.clear(minInput)
      await user.type(minInput, "250")
      await user.clear(maxInput)
      await user.type(maxInput, "750")
      
      await user.click(screen.getByText("Apply"))
      
      expect(mockOnChange).toHaveBeenCalledWith({
        min: 250,
        max: 750,
        currency: "USD"
      })
    })

    it("updates slider when input values change", async () => {
      const user = userEvent.setup()
      render(<AmountRangeFilter {...defaultProps} />)
      
      await user.click(screen.getByText("Select amount range"))
      
      const minInput = screen.getByLabelText("Min amount")
      await user.clear(minInput)
      await user.type(minInput, "1500")
      
      // The slider should update (we can't easily test the visual update)
      expect(minInput).toHaveValue(1500)
    })
  })

  describe("Clear Functionality", () => {
    it("clears the selected range", async () => {
      const user = userEvent.setup()
      const amountRange: AmountRange = {
        min: 1000,
        max: 5000,
        currency: "USD"
      }
      render(<AmountRangeFilter {...defaultProps} value={amountRange} />)
      
      await user.click(screen.getByText("$1,000 - $5,000"))
      await user.click(screen.getByText("Clear"))
      
      expect(mockOnChange).toHaveBeenCalledWith(undefined)
    })
  })

  describe("Validation", () => {
    it("only calls onChange when both values are valid", async () => {
      const user = userEvent.setup()
      render(<AmountRangeFilter {...defaultProps} />)
      
      await user.click(screen.getByText("Select amount range"))
      
      const minInput = screen.getByLabelText("Min amount")
      await user.clear(minInput)
      await user.type(minInput, "500")
      
      // Don't click Apply yet - onChange should not be called
      expect(mockOnChange).not.toHaveBeenCalled()
      
      await user.click(screen.getByText("Apply"))
      
      // Now it should be called with the values
      expect(mockOnChange).toHaveBeenCalledWith({
        min: 500,
        max: 100000, // default max
        currency: "USD"
      })
    })

    it("handles min greater than max gracefully", async () => {
      const user = userEvent.setup()
      render(<AmountRangeFilter {...defaultProps} />)
      
      await user.click(screen.getByText("Select amount range"))
      
      const minInput = screen.getByLabelText("Min amount")
      const maxInput = screen.getByLabelText("Max amount")
      
      await user.clear(minInput)
      await user.type(minInput, "5000")
      await user.clear(maxInput)
      await user.type(maxInput, "1000")
      
      await user.click(screen.getByText("Apply"))
      
      // Should not call onChange since min > max
      expect(mockOnChange).not.toHaveBeenCalled()
    })
  })

  describe("Currency Display", () => {
    it("respects currency prop", () => {
      const amountRange: AmountRange = {
        min: 1000,
        max: 5000,
        currency: "EUR"
      }
      render(<AmountRangeFilter {...defaultProps} value={amountRange} currency="EUR" />)
      
      // The component should format with EUR
      // Note: The exact format depends on the locale
      const button = screen.getByRole("button")
      expect(button.textContent).toMatch(/[€1,000|1.000 €].*[€5,000|5.000 €]/)
    })
  })

  describe("Slider Interaction", () => {
    it("updates values when slider is moved", async () => {
      const user = userEvent.setup()
      render(<AmountRangeFilter {...defaultProps} />)
      
      await user.click(screen.getByText("Select amount range"))
      
      // Find the slider inputs (there are two for range slider)
      const sliders = screen.getAllByRole("slider", { hidden: true })
      
      // Simulate slider change on the first slider (min value)
      fireEvent.change(sliders[0], { target: { value: "2500" } })
      
      const minInput = screen.getByLabelText("Min amount")
      expect(minInput).toHaveValue(2500)
    })
  })
})