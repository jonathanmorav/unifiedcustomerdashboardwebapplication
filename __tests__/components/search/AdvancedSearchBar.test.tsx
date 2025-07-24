import { render, screen, waitFor } from "@testing-library/react"
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
}))

describe("AdvancedSearchBar", () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe("Rendering", () => {
    it("renders all main components", () => {
      renderWithProviders(<AdvancedSearchBar />)

      // Search input
      expect(
        screen.getByPlaceholderText(/search by email, name, business name/i)
      ).toBeInTheDocument()

      // Search type selector
      expect(screen.getByRole("button", { name: /all sources/i })).toBeInTheDocument()

      // Filter button
      expect(screen.getByRole("button", { name: /filters/i })).toBeInTheDocument()

      // Sort dropdown
      expect(screen.getByRole("button", { name: /relevance/i })).toBeInTheDocument()
    })

    it("shows filter count when filters are applied", () => {
      renderWithProviders(<AdvancedSearchBar />)

      // Initially no filter count
      expect(screen.queryByText(/\d+/)).not.toBeInTheDocument()

      // TODO: Add test for filter count after applying filters
    })

    it("displays search results", () => {
      renderWithProviders(<AdvancedSearchBar />)

      // Results should be displayed
      mockAdvancedSearchResult.results.forEach((result) => {
        expect(screen.getByText(result.title)).toBeInTheDocument()
      })
    })

    it("shows result count and filtered count", () => {
      renderWithProviders(<AdvancedSearchBar />)

      expect(screen.getByText(/showing 3 of 25 results/i)).toBeInTheDocument()
    })
  })

  describe("Search Functionality", () => {
    it("performs search on form submit", async () => {
      const user = userEvent.setup()
      renderWithProviders(<AdvancedSearchBar />)

      const input = screen.getByPlaceholderText(/search by email, name, business name/i)
      await user.type(input, "test search")
      await user.keyboard("{Enter}")

      expect(mockSearch).toHaveBeenCalledWith(
        expect.objectContaining({
          searchTerm: "test search",
          searchType: "all",
        })
      )
    })

    it("changes search type", async () => {
      const user = userEvent.setup()
      renderWithProviders(<AdvancedSearchBar />)

      // Click search type button
      const typeButton = screen.getByRole("button", { name: /all sources/i })
      await user.click(typeButton)

      // Select HubSpot
      const hubspotOption = screen.getByRole("menuitem", { name: /hubspot/i })
      await user.click(hubspotOption)

      // Verify button text updated
      expect(screen.getByRole("button", { name: /hubspot/i })).toBeInTheDocument()

      // Perform search
      const input = screen.getByPlaceholderText(/search by email, name, business name/i)
      await user.type(input, "test")
      await user.keyboard("{Enter}")

      expect(mockSearch).toHaveBeenCalledWith(
        expect.objectContaining({
          searchType: "hubspot",
        })
      )
    })

    it("clears search and results", async () => {
      const user = userEvent.setup()
      renderWithProviders(<AdvancedSearchBar />)

      const input = screen.getByPlaceholderText(/search by email, name, business name/i)
      await user.type(input, "test search")

      // Clear button should appear
      const clearButton = screen.getByRole("button", { name: /clear/i })
      await user.click(clearButton)

      expect(input).toHaveValue("")
      expect(mockClearResults).toHaveBeenCalled()
    })
  })

  describe("Filter Panel", () => {
    it("opens filter panel on button click", async () => {
      const user = userEvent.setup()
      renderWithProviders(<AdvancedSearchBar />)

      const filterButton = screen.getByRole("button", { name: /filters/i })
      await user.click(filterButton)

      // Filter panel should be visible
      await waitFor(() => {
        expect(screen.getByText(/date range/i)).toBeInTheDocument()
        expect(screen.getByText(/amount range/i)).toBeInTheDocument()
        expect(screen.getByText(/status/i)).toBeInTheDocument()
      })
    })

    it("applies filters and shows count", async () => {
      const user = userEvent.setup()
      renderWithProviders(<AdvancedSearchBar />)

      // Open filter panel
      const filterButton = screen.getByRole("button", { name: /filters/i })
      await user.click(filterButton)

      // Select a status filter
      const activeCheckbox = screen.getByRole("checkbox", { name: /active/i })
      await user.click(activeCheckbox)

      // Apply filters
      const applyButton = screen.getByRole("button", { name: /apply filters/i })
      await user.click(applyButton)

      // Filter count should be shown
      expect(screen.getByText("1")).toBeInTheDocument()

      // Search should be triggered with filters
      expect(mockSearch).toHaveBeenCalledWith(
        expect.objectContaining({
          filters: expect.objectContaining({
            status: ["active"],
          }),
        })
      )
    })

    it("clears all filters", async () => {
      const user = userEvent.setup()
      renderWithProviders(<AdvancedSearchBar />)

      // Open filter panel
      const filterButton = screen.getByRole("button", { name: /filters/i })
      await user.click(filterButton)

      // Apply some filters
      const activeCheckbox = screen.getByRole("checkbox", { name: /active/i })
      await user.click(activeCheckbox)

      // Clear filters
      const clearButton = screen.getByRole("button", { name: /clear all/i })
      await user.click(clearButton)

      // Checkbox should be unchecked
      expect(activeCheckbox).not.toBeChecked()
    })
  })

  describe("Sorting", () => {
    it("changes sort order", async () => {
      const user = userEvent.setup()
      renderWithProviders(<AdvancedSearchBar />)

      // Click sort dropdown
      const sortButton = screen.getByRole("button", { name: /relevance/i })
      await user.click(sortButton)

      // Select date option
      const dateOption = screen.getByRole("menuitem", { name: /date \(newest\)/i })
      await user.click(dateOption)

      expect(mockSearch).toHaveBeenCalledWith(
        expect.objectContaining({
          sort: {
            field: "date",
            direction: "desc",
          },
        })
      )
    })
  })

  describe("Saved Searches", () => {
    it("opens save search dialog", async () => {
      const user = userEvent.setup()
      renderWithProviders(<AdvancedSearchBar />)

      // Perform a search first
      const input = screen.getByPlaceholderText(/search by email, name, business name/i)
      await user.type(input, "test search")
      await user.keyboard("{Enter}")

      // Click save search button
      const saveButton = screen.getByRole("button", { name: /save search/i })
      await user.click(saveButton)

      // Dialog should open
      await waitFor(() => {
        expect(screen.getByRole("dialog")).toBeInTheDocument()
        expect(screen.getByText(/save search/i)).toBeInTheDocument()
      })
    })

    it("saves search with name and description", async () => {
      const user = userEvent.setup()
      renderWithProviders(<AdvancedSearchBar />)

      // Perform a search
      const input = screen.getByPlaceholderText(/search by email, name, business name/i)
      await user.type(input, "test search")
      await user.keyboard("{Enter}")

      // Open save dialog
      const saveButton = screen.getByRole("button", { name: /save search/i })
      await user.click(saveButton)

      // Fill in name and description
      const nameInput = screen.getByLabelText(/name/i)
      const descInput = screen.getByLabelText(/description/i)

      await user.type(nameInput, "My Test Search")
      await user.type(descInput, "Search for test data")

      // Save
      const confirmButton = screen.getByRole("button", { name: /save/i })
      await user.click(confirmButton)

      expect(mockSaveSearch).toHaveBeenCalledWith({
        name: "My Test Search",
        description: "Search for test data",
        searchParams: expect.objectContaining({
          searchTerm: "test search",
        }),
      })
    })
  })

  describe("Pagination", () => {
    it("displays pagination controls", () => {
      renderWithProviders(<AdvancedSearchBar />)

      // Pagination should be present
      expect(screen.getByRole("button", { name: /previous/i })).toBeInTheDocument()
      expect(screen.getByRole("button", { name: /next/i })).toBeInTheDocument()
      expect(screen.getByText(/page 1/i)).toBeInTheDocument()
    })

    it("navigates to next page", async () => {
      const user = userEvent.setup()
      renderWithProviders(<AdvancedSearchBar />)

      const nextButton = screen.getByRole("button", { name: /next/i })
      await user.click(nextButton)

      expect(mockSearch).toHaveBeenCalledWith(
        expect.objectContaining({
          pagination: {
            page: 2,
            limit: 20,
          },
        })
      )
    })
  })

  describe("Error Handling", () => {
    it("displays error message", () => {
      // Mock error state
      jest.mocked(require("@/hooks/use-advanced-search").useAdvancedSearch).mockReturnValue({
        searchResults: null,
        isLoading: false,
        error: new Error("Search failed"),
        search: mockSearch,
        clearResults: mockClearResults,
      })

      renderWithProviders(<AdvancedSearchBar />)

      expect(screen.getByText(/search failed/i)).toBeInTheDocument()
    })
  })

  describe("Loading State", () => {
    it("shows loading indicator", () => {
      // Mock loading state
      jest.mocked(require("@/hooks/use-advanced-search").useAdvancedSearch).mockReturnValue({
        searchResults: null,
        isLoading: true,
        error: null,
        search: mockSearch,
        clearResults: mockClearResults,
      })

      renderWithProviders(<AdvancedSearchBar />)

      expect(screen.getByRole("progressbar")).toBeInTheDocument()
    })
  })

  describe("Empty State", () => {
    it("shows empty state when no results", () => {
      // Mock empty results
      jest.mocked(require("@/hooks/use-advanced-search").useAdvancedSearch).mockReturnValue({
        searchResults: { ...mockAdvancedSearchResult, results: [], totalCount: 0 },
        isLoading: false,
        error: null,
        search: mockSearch,
        clearResults: mockClearResults,
      })

      renderWithProviders(<AdvancedSearchBar />)

      expect(screen.getByText(/no results found/i)).toBeInTheDocument()
    })
  })

  describe("Accessibility", () => {
    it("has proper ARIA labels", () => {
      renderWithProviders(<AdvancedSearchBar />)

      expect(screen.getByLabelText(/search/i)).toBeInTheDocument()
      expect(screen.getByLabelText(/search type/i)).toBeInTheDocument()
      expect(screen.getByLabelText(/sort by/i)).toBeInTheDocument()
    })

    it("supports keyboard navigation", async () => {
      const user = userEvent.setup()
      renderWithProviders(<AdvancedSearchBar />)

      // Tab through controls
      await user.tab()
      expect(screen.getByPlaceholderText(/search by email/i)).toHaveFocus()

      await user.tab()
      expect(screen.getByRole("button", { name: /all sources/i })).toHaveFocus()

      await user.tab()
      expect(screen.getByRole("button", { name: /filters/i })).toHaveFocus()
    })
  })
})
