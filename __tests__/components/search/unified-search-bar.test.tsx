import { render, screen, fireEvent, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { UnifiedSearchBar } from "@/components/search/unified-search-bar"
import { SearchType } from "@/lib/search/unified-search"
import { mockSearchSuggestions } from "@/__mocks__/search-results"

// Mock the hooks
jest.mock("@/hooks/use-search-history", () => ({
  useSearchSuggestions: () => ({
    suggestions: mockSearchSuggestions,
    fetchSuggestions: jest.fn(),
  }),
}))

jest.mock("@/hooks/use-debounce", () => ({
  useDebounce: (value: string) => value,
}))

describe("UnifiedSearchBar", () => {
  const mockOnSearch = jest.fn()
  const defaultProps = {
    onSearch: mockOnSearch,
    searchType: "all" as SearchType,
    isLoading: false,
  }

  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe("Rendering", () => {
    it("renders search input with placeholder", () => {
      render(<UnifiedSearchBar {...defaultProps} />)
      const input = screen.getByPlaceholderText(
        "Search by email, name, business name, or Dwolla ID..."
      )
      expect(input).toBeInTheDocument()
    })

    it("renders search button", () => {
      render(<UnifiedSearchBar {...defaultProps} />)
      const button = screen.getByRole("button", { name: /search/i })
      expect(button).toBeInTheDocument()
    })

    it("disables input and button when loading", () => {
      render(<UnifiedSearchBar {...defaultProps} isLoading={true} />)
      const input = screen.getByPlaceholderText(
        "Search by email, name, business name, or Dwolla ID..."
      )
      const button = screen.getByRole("button")
      expect(input).toBeDisabled()
      expect(button).toBeDisabled()
    })

    it("shows loading spinner when loading", () => {
      render(<UnifiedSearchBar {...defaultProps} isLoading={true} />)
      const spinner = screen.getByRole("button")
      expect(spinner.querySelector(".animate-spin")).toBeInTheDocument()
    })

    it("applies custom className", () => {
      const { container } = render(
        <UnifiedSearchBar {...defaultProps} className="custom-class" />
      )
      expect(container.firstChild).toHaveClass("custom-class")
    })
  })

  describe("User Interactions", () => {
    it("updates input value on type", async () => {
      const user = userEvent.setup()
      render(<UnifiedSearchBar {...defaultProps} />)
      const input = screen.getByPlaceholderText(
        "Search by email, name, business name, or Dwolla ID..."
      )
      
      await user.type(input, "test search")
      expect(input).toHaveValue("test search")
    })

    it("calls onSearch when form is submitted", async () => {
      const user = userEvent.setup()
      render(<UnifiedSearchBar {...defaultProps} />)
      const input = screen.getByPlaceholderText(
        "Search by email, name, business name, or Dwolla ID..."
      )
      
      await user.type(input, "test search")
      await user.keyboard("{Enter}")
      
      expect(mockOnSearch).toHaveBeenCalledWith("test search", "all")
      expect(mockOnSearch).toHaveBeenCalledTimes(1)
    })

    it("calls onSearch when search button is clicked", async () => {
      const user = userEvent.setup()
      render(<UnifiedSearchBar {...defaultProps} />)
      const input = screen.getByPlaceholderText(
        "Search by email, name, business name, or Dwolla ID..."
      )
      const button = screen.getByRole("button", { name: /search/i })
      
      await user.type(input, "test search")
      await user.click(button)
      
      expect(mockOnSearch).toHaveBeenCalledWith("test search", "all")
    })

    it("trims whitespace from search term", async () => {
      const user = userEvent.setup()
      render(<UnifiedSearchBar {...defaultProps} />)
      const input = screen.getByPlaceholderText(
        "Search by email, name, business name, or Dwolla ID..."
      )
      
      await user.type(input, "  test search  ")
      await user.keyboard("{Enter}")
      
      expect(mockOnSearch).toHaveBeenCalledWith("test search", "all")
    })

    it("does not submit empty search", async () => {
      const user = userEvent.setup()
      render(<UnifiedSearchBar {...defaultProps} />)
      const input = screen.getByPlaceholderText(
        "Search by email, name, business name, or Dwolla ID..."
      )
      
      await user.type(input, "   ")
      await user.keyboard("{Enter}")
      
      expect(mockOnSearch).not.toHaveBeenCalled()
    })

    it("shows clear button when input has value", async () => {
      const user = userEvent.setup()
      render(<UnifiedSearchBar {...defaultProps} />)
      const input = screen.getByPlaceholderText(
        "Search by email, name, business name, or Dwolla ID..."
      )
      
      expect(screen.queryByRole("button", { name: "" })).not.toBeInTheDocument()
      
      await user.type(input, "test")
      const clearButton = screen.getAllByRole("button")[0]
      expect(clearButton).toBeInTheDocument()
    })

    it("clears input when clear button is clicked", async () => {
      const user = userEvent.setup()
      render(<UnifiedSearchBar {...defaultProps} />)
      const input = screen.getByPlaceholderText(
        "Search by email, name, business name, or Dwolla ID..."
      ) as HTMLInputElement
      
      await user.type(input, "test search")
      expect(input.value).toBe("test search")
      
      const clearButton = screen.getAllByRole("button")[0]
      await user.click(clearButton)
      
      expect(input.value).toBe("")
    })
  })

  describe("Search Suggestions", () => {
    it("shows suggestions when typing", async () => {
      const user = userEvent.setup()
      render(<UnifiedSearchBar {...defaultProps} />)
      const input = screen.getByPlaceholderText(
        "Search by email, name, business name, or Dwolla ID..."
      )
      
      await user.type(input, "acme")
      
      await waitFor(() => {
        mockSearchSuggestions.forEach((suggestion) => {
          expect(screen.getByText(suggestion)).toBeInTheDocument()
        })
      })
    })

    it("hides suggestions when input is cleared", async () => {
      const user = userEvent.setup()
      render(<UnifiedSearchBar {...defaultProps} />)
      const input = screen.getByPlaceholderText(
        "Search by email, name, business name, or Dwolla ID..."
      )
      
      await user.type(input, "acme")
      await waitFor(() => {
        expect(screen.getByText(mockSearchSuggestions[0])).toBeInTheDocument()
      })
      
      await user.clear(input)
      
      await waitFor(() => {
        mockSearchSuggestions.forEach((suggestion) => {
          expect(screen.queryByText(suggestion)).not.toBeInTheDocument()
        })
      })
    })

    it("selects suggestion on click", async () => {
      const user = userEvent.setup()
      render(<UnifiedSearchBar {...defaultProps} />)
      const input = screen.getByPlaceholderText(
        "Search by email, name, business name, or Dwolla ID..."
      )
      
      await user.type(input, "acme")
      await waitFor(() => {
        expect(screen.getByText(mockSearchSuggestions[0])).toBeInTheDocument()
      })
      
      await user.click(screen.getByText(mockSearchSuggestions[0]))
      
      expect(mockOnSearch).toHaveBeenCalledWith(mockSearchSuggestions[0], "all")
    })

    it.skip("hides suggestions on blur", async () => {
      const user = userEvent.setup()
      render(<UnifiedSearchBar {...defaultProps} />)
      const input = screen.getByPlaceholderText(
        "Search by email, name, business name, or Dwolla ID..."
      )
      
      await user.type(input, "acme")
      await waitFor(() => {
        expect(screen.getByText(mockSearchSuggestions[0])).toBeInTheDocument()
      })
      
      // Click outside to blur
      await user.click(document.body)
      
      await waitFor(() => {
        mockSearchSuggestions.forEach((suggestion) => {
          expect(screen.queryByText(suggestion)).not.toBeInTheDocument()
        })
      }, { timeout: 500 })
    })
  })

  describe("Accessibility", () => {
    it("has accessible form structure", () => {
      const { container } = render(<UnifiedSearchBar {...defaultProps} />)
      const form = container.querySelector("form")
      expect(form).toBeInTheDocument()
    })

    it("search input has proper type", () => {
      render(<UnifiedSearchBar {...defaultProps} />)
      const input = screen.getByPlaceholderText(
        "Search by email, name, business name, or Dwolla ID..."
      )
      expect(input).toHaveAttribute("type", "text")
    })

    it("search button has proper type", () => {
      render(<UnifiedSearchBar {...defaultProps} />)
      const button = screen.getByRole("button", { name: /search/i })
      expect(button).toHaveAttribute("type", "submit")
    })

    it("clear button has proper type", async () => {
      const user = userEvent.setup()
      render(<UnifiedSearchBar {...defaultProps} />)
      const input = screen.getByPlaceholderText(
        "Search by email, name, business name, or Dwolla ID..."
      )
      
      await user.type(input, "test")
      const clearButton = screen.getAllByRole("button")[0]
      expect(clearButton).toHaveAttribute("type", "button")
    })
  })

  describe("Edge Cases", () => {
    it("handles rapid typing and clearing", async () => {
      const user = userEvent.setup()
      render(<UnifiedSearchBar {...defaultProps} />)
      const input = screen.getByPlaceholderText(
        "Search by email, name, business name, or Dwolla ID..."
      )
      
      await user.type(input, "test")
      await user.clear(input)
      await user.type(input, "another")
      await user.clear(input)
      await user.type(input, "final")
      await user.keyboard("{Enter}")
      
      expect(mockOnSearch).toHaveBeenCalledWith("final", "all")
      expect(mockOnSearch).toHaveBeenCalledTimes(1)
    })

    it("handles special characters in search", async () => {
      const user = userEvent.setup()
      render(<UnifiedSearchBar {...defaultProps} />)
      const input = screen.getByPlaceholderText(
        "Search by email, name, business name, or Dwolla ID..."
      )
      
      await user.type(input, "test@example.com")
      await user.keyboard("{Enter}")
      
      expect(mockOnSearch).toHaveBeenCalledWith("test@example.com", "all")
    })

    it("maintains search type across searches", async () => {
      const user = userEvent.setup()
      const { rerender } = render(
        <UnifiedSearchBar {...defaultProps} searchType="hubspot" />
      )
      const input = screen.getByPlaceholderText(
        "Search by email, name, business name, or Dwolla ID..."
      )
      
      await user.type(input, "first search")
      await user.keyboard("{Enter}")
      expect(mockOnSearch).toHaveBeenCalledWith("first search", "hubspot")
      
      rerender(<UnifiedSearchBar {...defaultProps} searchType="dwolla" />)
      
      await user.clear(input)
      await user.type(input, "second search")
      await user.keyboard("{Enter}")
      expect(mockOnSearch).toHaveBeenCalledWith("second search", "dwolla")
    })
  })
})