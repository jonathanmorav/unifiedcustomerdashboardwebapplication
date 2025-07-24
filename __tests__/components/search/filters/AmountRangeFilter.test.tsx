import { render, screen, fireEvent, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { AmountRangeFilter } from "@/components/search/filters/AmountRangeFilter"
import { AmountRange } from "@/lib/types/search"

describe("AmountRangeFilter", () => {
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
      render(<AmountRangeFilter {...defaultProps} />)
      expect(screen.getByText("Amount Range")).toBeInTheDocument()
    })

    it("shows placeholder inputs when no value", () => {
      render(<AmountRangeFilter {...defaultProps} />)

      const minInput = screen.getByPlaceholderText("Min")
      const maxInput = screen.getByPlaceholderText("Max")

      expect(minInput).toBeInTheDocument()
      expect(maxInput).toBeInTheDocument()
      expect(minInput).toHaveValue("")
      expect(maxInput).toHaveValue("")
    })

    it("displays selected amount range", () => {
      const amountRange: AmountRange = {
        min: 1000,
        max: 5000,
      }
      render(<AmountRangeFilter {...defaultProps} value={amountRange} />)

      const minInput = screen.getByPlaceholderText("Min")
      const maxInput = screen.getByPlaceholderText("Max")

      expect(minInput).toHaveValue("1000")
      expect(maxInput).toHaveValue("5000")
    })

    it("formats amounts with commas", () => {
      const amountRange: AmountRange = {
        min: 10000,
        max: 50000,
      }
      render(<AmountRangeFilter {...defaultProps} value={amountRange} />)

      const minInput = screen.getByPlaceholderText("Min") as HTMLInputElement
      const maxInput = screen.getByPlaceholderText("Max") as HTMLInputElement

      expect(minInput.value).toBe("10,000")
      expect(maxInput.value).toBe("50,000")
    })
  })

  describe("User Input", () => {
    it("updates min value on input", async () => {
      const user = userEvent.setup()
      render(<AmountRangeFilter {...defaultProps} />)

      const minInput = screen.getByPlaceholderText("Min")
      await user.type(minInput, "1000")

      expect(minInput).toHaveValue("1,000")
    })

    it("updates max value on input", async () => {
      const user = userEvent.setup()
      render(<AmountRangeFilter {...defaultProps} />)

      const maxInput = screen.getByPlaceholderText("Max")
      await user.type(maxInput, "5000")

      expect(maxInput).toHaveValue("5,000")
    })

    it("calls onChange when both values are entered", async () => {
      const user = userEvent.setup()
      render(<AmountRangeFilter {...defaultProps} />)

      const minInput = screen.getByPlaceholderText("Min")
      const maxInput = screen.getByPlaceholderText("Max")

      await user.type(minInput, "1000")
      await user.type(maxInput, "5000")

      // onChange is debounced, so we need to wait
      await waitFor(() => {
        expect(mockOnChange).toHaveBeenCalledWith({
          min: 1000,
          max: 5000,
        })
      })
    })

    it("handles decimal input", async () => {
      const user = userEvent.setup()
      render(<AmountRangeFilter {...defaultProps} />)

      const minInput = screen.getByPlaceholderText("Min")
      await user.type(minInput, "1000.50")

      expect(minInput).toHaveValue("1,000.50")
    })

    it("ignores non-numeric input", async () => {
      const user = userEvent.setup()
      render(<AmountRangeFilter {...defaultProps} />)

      const minInput = screen.getByPlaceholderText("Min")
      await user.type(minInput, "abc123def")

      expect(minInput).toHaveValue("123")
    })
  })

  describe("Clear Functionality", () => {
    it("shows clear button when value exists", () => {
      const amountRange: AmountRange = {
        min: 1000,
        max: 5000,
      }
      render(<AmountRangeFilter {...defaultProps} value={amountRange} />)

      const clearButton = screen.getByRole("button", { name: /clear/i })
      expect(clearButton).toBeInTheDocument()
    })

    it("clears both inputs when clear button clicked", async () => {
      const user = userEvent.setup()
      const amountRange: AmountRange = {
        min: 1000,
        max: 5000,
      }
      render(<AmountRangeFilter {...defaultProps} value={amountRange} />)

      const clearButton = screen.getByRole("button", { name: /clear/i })
      await user.click(clearButton)

      expect(mockOnChange).toHaveBeenCalledWith(undefined)

      const minInput = screen.getByPlaceholderText("Min")
      const maxInput = screen.getByPlaceholderText("Max")

      expect(minInput).toHaveValue("")
      expect(maxInput).toHaveValue("")
    })

    it("does not show clear button when no value", () => {
      render(<AmountRangeFilter {...defaultProps} />)

      const clearButton = screen.queryByRole("button", { name: /clear/i })
      expect(clearButton).not.toBeInTheDocument()
    })
  })

  describe("Validation", () => {
    it("does not call onChange with only min value", async () => {
      const user = userEvent.setup()
      render(<AmountRangeFilter {...defaultProps} />)

      const minInput = screen.getByPlaceholderText("Min")
      await user.type(minInput, "1000")

      await waitFor(
        () => {
          expect(mockOnChange).not.toHaveBeenCalled()
        },
        { timeout: 600 }
      )
    })

    it("does not call onChange with only max value", async () => {
      const user = userEvent.setup()
      render(<AmountRangeFilter {...defaultProps} />)

      const maxInput = screen.getByPlaceholderText("Max")
      await user.type(maxInput, "5000")

      await waitFor(
        () => {
          expect(mockOnChange).not.toHaveBeenCalled()
        },
        { timeout: 600 }
      )
    })

    it("swaps values if min is greater than max", async () => {
      const user = userEvent.setup()
      render(<AmountRangeFilter {...defaultProps} />)

      const minInput = screen.getByPlaceholderText("Min")
      const maxInput = screen.getByPlaceholderText("Max")

      await user.type(minInput, "5000")
      await user.type(maxInput, "1000")

      await waitFor(() => {
        expect(mockOnChange).toHaveBeenCalledWith({
          min: 1000,
          max: 5000,
        })
      })
    })

    it("handles negative values", async () => {
      const user = userEvent.setup()
      render(<AmountRangeFilter {...defaultProps} />)

      const minInput = screen.getByPlaceholderText("Min")
      await user.type(minInput, "-100")

      expect(minInput).toHaveValue("100")
    })
  })

  describe("Keyboard Navigation", () => {
    it("moves focus from min to max on Tab", async () => {
      const user = userEvent.setup()
      render(<AmountRangeFilter {...defaultProps} />)

      const minInput = screen.getByPlaceholderText("Min")
      const maxInput = screen.getByPlaceholderText("Max")

      minInput.focus()
      await user.tab()

      expect(maxInput).toHaveFocus()
    })

    it("submits on Enter in max field", async () => {
      const user = userEvent.setup()
      render(<AmountRangeFilter {...defaultProps} />)

      const minInput = screen.getByPlaceholderText("Min")
      const maxInput = screen.getByPlaceholderText("Max")

      await user.type(minInput, "1000")
      await user.type(maxInput, "5000")
      await user.keyboard("{Enter}")

      await waitFor(() => {
        expect(mockOnChange).toHaveBeenCalledWith({
          min: 1000,
          max: 5000,
        })
      })
    })
  })

  describe("Currency Display", () => {
    it("shows currency symbol", () => {
      render(<AmountRangeFilter {...defaultProps} />)

      // Check for dollar signs
      const dollarSigns = screen.getAllByText("$")
      expect(dollarSigns).toHaveLength(2)
    })

    it("respects currency prop", () => {
      render(<AmountRangeFilter {...defaultProps} currency="EUR" />)

      // Check for Euro signs
      const euroSigns = screen.getAllByText("€")
      expect(euroSigns).toHaveLength(2)
    })
  })

  describe("Disabled State", () => {
    it("disables inputs when disabled prop is true", () => {
      render(<AmountRangeFilter {...defaultProps} disabled={true} />)

      const minInput = screen.getByPlaceholderText("Min")
      const maxInput = screen.getByPlaceholderText("Max")

      expect(minInput).toBeDisabled()
      expect(maxInput).toBeDisabled()
    })

    it("does not allow input when disabled", async () => {
      const user = userEvent.setup()
      render(<AmountRangeFilter {...defaultProps} disabled={true} />)

      const minInput = screen.getByPlaceholderText("Min")
      await user.type(minInput, "1000")

      expect(minInput).toHaveValue("")
    })
  })

  describe("Edge Cases", () => {
    it("handles very large numbers", async () => {
      const user = userEvent.setup()
      render(<AmountRangeFilter {...defaultProps} />)

      const minInput = screen.getByPlaceholderText("Min")
      await user.type(minInput, "1000000000")

      expect(minInput).toHaveValue("1,000,000,000")
    })

    it("handles rapid input changes", async () => {
      const user = userEvent.setup()
      render(<AmountRangeFilter {...defaultProps} />)

      const minInput = screen.getByPlaceholderText("Min")
      const maxInput = screen.getByPlaceholderText("Max")

      // Rapidly change values
      await user.type(minInput, "1")
      await user.type(minInput, "0")
      await user.type(minInput, "0")
      await user.type(maxInput, "5")
      await user.type(maxInput, "0")
      await user.type(maxInput, "0")

      await waitFor(() => {
        expect(mockOnChange).toHaveBeenCalledWith({
          min: 100,
          max: 500,
        })
      })
    })

    it("handles paste events", async () => {
      const user = userEvent.setup()
      render(<AmountRangeFilter {...defaultProps} />)

      const minInput = screen.getByPlaceholderText("Min")

      // Simulate paste
      await user.click(minInput)
      await user.paste("1500.75")

      expect(minInput).toHaveValue("1,500.75")
    })
  })
})
