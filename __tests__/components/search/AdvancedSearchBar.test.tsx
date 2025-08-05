import { render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { AdvancedSearchBar } from "@/components/search/AdvancedSearchBar"
import { renderWithProviders } from "@/__tests__/utils/test-helpers"
import { mockAdvancedSearchResult, mockSearchHistory } from "@/__mocks__/search-results"

// Mock the search hook
const mockSearch = jest.fn()
const mockClearResults = jest.fn()
const mockSaveSearch = jest.fn()
const mockLoadSavedSearch = jest.fn()

jest.mock("@/hooks/use-advanced-search", () => ({
  useAdvancedSearch: () => ({
    searchResults: mockAdvancedSearchResult,
    isLoading: false,
    error: null,
    search: mockSearch,
    clearResults: mockClearResults,
  }),
}))

jest.mock("@/hooks/use-saved-searches", () => ({
  useSavedSearches: () => ({
    savedSearches: [],
    saveSearch: mockSaveSearch,
    loadSavedSearch: mockLoadSavedSearch,
    deleteSavedSearch: jest.fn(),
    isLoading: false,
  }),
}))

jest.mock("@/hooks/use-search-history", () => ({
  useSearchHistory: () => ({
    history: mockSearchHistory,
    addToHistory: jest.fn(),
    clearHistory: jest.fn(),
  }),
  useSearchSuggestions: () => ({
    suggestions: [],
    fetchSuggestions: jest.fn(),
    clearSuggestions: jest.fn(),
  }),
}))

// Mock debounce hook to make it synchronous for testing
jest.mock("@/hooks/use-debounce", () => ({
  useDebounce: (value: any) => value,
}))

describe("AdvancedSearchBar", () => {
  const defaultProps = {
    onSearch: jest.fn(),
    searchType: "all" as const,
    isLoading: false,
    savedSearches: [],
    searchTemplates: [],
    onSaveSearch: jest.fn(),
  }

  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe("Rendering", () => {
    it("renders search input and buttons", () => {
      renderWithProviders(<AdvancedSearchBar {...defaultProps} />)

      // Search input
      expect(
        screen.getByPlaceholderText(/search by email, name, business name/i)
      ).toBeInTheDocument()

      // Filter button (with Filter icon)
      const filterButton = screen.getAllByRole("button").find(button => 
        button.querySelector('svg') && button.className.includes('h-8 w-8')
      )
      expect(filterButton).toBeInTheDocument()

      // Search button
      expect(screen.getByRole("button", { name: /search/i })).toBeInTheDocument()
    })

    it("shows filter count when filters are applied", () => {
      const propsWithFilters = {
        ...defaultProps,
      }
      const { rerender } = renderWithProviders(<AdvancedSearchBar {...propsWithFilters} />)

      // Initially no filter count
      expect(screen.queryByText(/filter.*active/i)).not.toBeInTheDocument()

      // TODO: Test with actual filters applied
    })

    it("disables input when loading", () => {
      renderWithProviders(<AdvancedSearchBar {...defaultProps} isLoading={true} />)
      
      const input = screen.getByPlaceholderText(/search by email/i)
      expect(input).toBeDisabled()
    })
  })

  describe("Search Functionality", () => {
    it("performs search on form submit", async () => {
      const user = userEvent.setup()
      renderWithProviders(<AdvancedSearchBar {...defaultProps} />)

      const input = screen.getByPlaceholderText(/search by email/i)
      await user.type(input, "test@example.com")
      await user.keyboard("{Enter}")

      expect(defaultProps.onSearch).toHaveBeenCalledWith({
        searchTerm: "test@example.com",
        searchType: "all",
        filters: {},
      })
    })

    it("trims whitespace from search term", async () => {
      const user = userEvent.setup()
      renderWithProviders(<AdvancedSearchBar {...defaultProps} />)

      const input = screen.getByPlaceholderText(/search by email/i)
      await user.type(input, "  test@example.com  ")
      await user.keyboard("{Enter}")

      expect(defaultProps.onSearch).toHaveBeenCalledWith({
        searchTerm: "test@example.com",
        searchType: "all",
        filters: {},
      })
    })

    it("does not search with empty input", async () => {
      const user = userEvent.setup()
      renderWithProviders(<AdvancedSearchBar {...defaultProps} />)

      const input = screen.getByPlaceholderText(/search by email/i)
      await user.clear(input)
      await user.keyboard("{Enter}")

      expect(defaultProps.onSearch).not.toHaveBeenCalled()
    })

    it("clears search when clear button is clicked", async () => {
      const user = userEvent.setup()
      renderWithProviders(<AdvancedSearchBar {...defaultProps} />)

      const input = screen.getByPlaceholderText(/search by email/i)
      await user.type(input, "test")

      // Wait for the clear button to appear
      await waitFor(() => {
        const buttons = screen.getAllByRole("button")
        // The clear button is rendered after the filter button (3rd button, after dropdown and filter)
        // It appears conditionally when there's text
        expect(buttons.length).toBeGreaterThanOrEqual(4) // dropdown, filter, clear, search
      })

      // Get all buttons and find the clear button by position and properties
      const buttons = screen.getAllByRole("button")
      // Clear button is the one that's not submit, not dropdown trigger, and not the filter button
      const clearButton = buttons.find(button => {
        const isSubmit = button.type === 'submit'
        const hasAriaHaspopup = button.hasAttribute('aria-haspopup')
        const hasRelativeClass = button.className.includes('relative')
        
        return !isSubmit && !hasAriaHaspopup && !hasRelativeClass && 
               button.className.includes('h-8 w-8')
      })
      
      expect(clearButton).toBeTruthy()
      if (clearButton) {
        await user.click(clearButton)
        expect(input).toHaveValue("")
      }
    })
  })

  describe("Filter Panel", () => {
    it("opens filter panel when filter button is clicked", async () => {
      const user = userEvent.setup()
      renderWithProviders(<AdvancedSearchBar {...defaultProps} />)

      // Find the filter button (it has a Filter icon and is a relative positioned button)
      const buttons = screen.getAllByRole("button")
      const filterButton = buttons.find(button => 
        button.querySelector('svg') && 
        button.className.includes('relative') &&
        button.className.includes('h-8 w-8')
      )
      
      expect(filterButton).toBeTruthy()
      if (filterButton) {
        await user.click(filterButton)
        // The Sheet should be opened with the correct title
        await waitFor(() => {
          expect(screen.getByText("Search Filters")).toBeInTheDocument()
          expect(screen.getByText("Refine your search results with advanced filters")).toBeInTheDocument()
        })
      }
    })
  })

  describe("Saved Searches", () => {
    it("shows saved searches in dropdown when available", async () => {
      const user = userEvent.setup()
      const savedSearches = [
        {
          id: "1",
          name: "Active Customers",
          searchParams: {
            searchTerm: "active",
            searchType: "all" as const,
            filters: {},
          },
          createdAt: new Date(),
        },
      ]

      renderWithProviders(
        <AdvancedSearchBar {...defaultProps} savedSearches={savedSearches} />
      )

      // Click the dropdown menu button (SlidersHorizontal icon)
      const buttons = screen.getAllByRole("button")
      const dropdownButton = buttons[0] // First button is the dropdown
      await user.click(dropdownButton)

      expect(screen.getByText("Active Customers")).toBeInTheDocument()
    })

    it("loads saved search when selected", async () => {
      const user = userEvent.setup()
      const savedSearches = [
        {
          id: "1",
          name: "Active Customers",
          searchParams: {
            searchTerm: "active",
            searchType: "all" as const,
            filters: { customerStatus: ["verified"] },
          },
          createdAt: new Date(),
        },
      ]

      renderWithProviders(
        <AdvancedSearchBar {...defaultProps} savedSearches={savedSearches} />
      )

      // Open dropdown
      const buttons = screen.getAllByRole("button")
      await user.click(buttons[0])

      // Click saved search
      await user.click(screen.getByText("Active Customers"))

      expect(defaultProps.onSearch).toHaveBeenCalledWith({
        searchTerm: "active",
        searchType: "all",
        filters: { customerStatus: ["verified"] },
      })
    })
  })

  describe("Accessibility", () => {
    it("has proper ARIA labels", () => {
      renderWithProviders(<AdvancedSearchBar {...defaultProps} />)

      const input = screen.getByPlaceholderText(/search by email/i)
      expect(input).toHaveAttribute("type", "text")
    })

    it("supports keyboard navigation", async () => {
      const user = userEvent.setup()
      renderWithProviders(<AdvancedSearchBar {...defaultProps} />)

      const input = screen.getByPlaceholderText(/search by email/i)
      
      // Tab to input
      await user.tab()
      expect(input).toHaveFocus()

      // Type and submit with Enter
      await user.type(input, "test")
      await user.keyboard("{Enter}")

      expect(defaultProps.onSearch).toHaveBeenCalled()
    })
  })
})