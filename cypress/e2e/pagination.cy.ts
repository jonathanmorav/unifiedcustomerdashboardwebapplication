describe("Pagination Tests", () => {
  beforeEach(() => {
    // Set up API interceptors with multiple pages of data
    cy.intercept("GET", "/api/ach/transactions*page=1*", {
      statusCode: 200,
      body: {
        transactions: Array.from({ length: 10 }, (_, i) => ({
          id: `page1-transaction-${i + 1}`,
          amount: (i + 1) * 100,
          status: "processed",
          created: "2023-03-15T10:00:00Z",
          customerName: `Customer ${i + 1}`,
          reference: `REF-P1-${i + 1}`,
          direction: "credit",
        })),
        pagination: {
          total: 47, // Total results across all pages
          totalPages: 5, // 47 results / 10 per page = 5 pages
          currentPage: 1,
          pageSize: 10,
        },
        metrics: {
          totalAmount: 5500,
          totalCount: 10,
        },
      },
    }).as("getTransactionsPage1")

    cy.intercept("GET", "/api/ach/transactions*page=2*", {
      statusCode: 200,
      body: {
        transactions: Array.from({ length: 10 }, (_, i) => ({
          id: `page2-transaction-${i + 1}`,
          amount: (i + 11) * 100,
          status: "processing",
          created: "2023-03-16T10:00:00Z",
          customerName: `Customer ${i + 11}`,
          reference: `REF-P2-${i + 1}`,
          direction: "debit",
        })),
        pagination: {
          total: 47,
          totalPages: 5,
          currentPage: 2,
          pageSize: 10,
        },
        metrics: {
          totalAmount: 16500,
          totalCount: 10,
        },
      },
    }).as("getTransactionsPage2")

    cy.intercept("GET", "/api/ach/transactions*page=3*", {
      statusCode: 200,
      body: {
        transactions: Array.from({ length: 10 }, (_, i) => ({
          id: `page3-transaction-${i + 1}`,
          amount: (i + 21) * 100,
          status: "pending",
          created: "2023-03-17T10:00:00Z",
          customerName: `Customer ${i + 21}`,
          reference: `REF-P3-${i + 1}`,
          direction: "credit",
        })),
        pagination: {
          total: 47,
          totalPages: 5,
          currentPage: 3,
          pageSize: 10,
        },
        metrics: {
          totalAmount: 25500,
          totalCount: 10,
        },
      },
    }).as("getTransactionsPage3")

    cy.intercept("GET", "/api/ach/transactions*page=5*", {
      statusCode: 200,
      body: {
        transactions: Array.from({ length: 7 }, (_, i) => ({
          id: `page5-transaction-${i + 1}`,
          amount: (i + 41) * 100,
          status: "failed",
          created: "2023-03-19T10:00:00Z",
          customerName: `Customer ${i + 41}`,
          reference: `REF-P5-${i + 1}`,
          direction: "debit",
        })),
        pagination: {
          total: 47,
          totalPages: 5,
          currentPage: 5,
          pageSize: 10,
        },
        metrics: {
          totalAmount: 30100,
          totalCount: 7, // Last page has only 7 items
        },
      },
    }).as("getTransactionsPage5")

    // Visit the billing page
    cy.visit("/billing")

    // Wait for the page to load
    cy.get('[data-testid="billing-filters"]').should("be.visible")
    cy.wait("@getTransactionsPage1")
  })

  it("should show correct number of pages in pagination", () => {
    // Verify that pagination shows the correct total pages
    cy.get('[aria-label="Go to page 5"]').should("be.visible") // Should show page 5
    cy.get('[aria-label="Go to page 6"]').should("not.exist") // Should not show page 6

    // Verify pagination info text
    cy.contains("Showing 1 to 10 of 47 results").should("be.visible")

    // Verify total pages indicator
    cy.get('[data-testid*="pagination"], [class*="pagination"]').within(() => {
      cy.contains("5").should("be.visible") // Should show page 5 as the last page
    })
  })

  it("should navigate to different pages correctly", () => {
    // Navigate to page 2
    cy.get('[aria-label="Go to page 2"]').click()
    cy.wait("@getTransactionsPage2")

    // Verify page 2 content is loaded
    cy.contains("Customer 11").should("be.visible")
    cy.contains("Showing 11 to 20 of 47 results").should("be.visible")

    // Verify current page is highlighted
    cy.get('[aria-current="page"]').should("contain", "2")

    // Navigate to page 3
    cy.get('[aria-label="Go to page 3"]').click()
    cy.wait("@getTransactionsPage3")

    // Verify page 3 content
    cy.contains("Customer 21").should("be.visible")
    cy.contains("Showing 21 to 30 of 47 results").should("be.visible")
    cy.get('[aria-current="page"]').should("contain", "3")
  })

  it("should handle first/previous/next/last navigation", () => {
    // Start on page 1, navigate to page 3 first
    cy.get('[aria-label="Go to page 3"]').click()
    cy.wait("@getTransactionsPage3")

    // Test Previous button
    cy.get('[aria-label="Go to previous page"]').click()
    cy.wait("@getTransactionsPage2")
    cy.get('[aria-current="page"]').should("contain", "2")

    // Test Next button
    cy.get('[aria-label="Go to next page"]').click()
    cy.wait("@getTransactionsPage3")
    cy.get('[aria-current="page"]').should("contain", "3")

    // Test First page button
    cy.get('[aria-label="Go to first page"]').click()
    cy.wait("@getTransactionsPage1")
    cy.get('[aria-current="page"]').should("contain", "1")

    // Test Last page button
    cy.get('[aria-label="Go to last page"]').click()
    cy.wait("@getTransactionsPage5")
    cy.get('[aria-current="page"]').should("contain", "5")

    // Verify last page has correct item count
    cy.contains("Showing 41 to 47 of 47 results").should("be.visible")
  })

  it("should disable appropriate navigation buttons", () => {
    // On first page, first and previous should be disabled
    cy.get('[aria-label="Go to first page"]').should("be.disabled")
    cy.get('[aria-label="Go to previous page"]').should("be.disabled")
    cy.get('[aria-label="Go to next page"]').should("not.be.disabled")
    cy.get('[aria-label="Go to last page"]').should("not.be.disabled")

    // Navigate to last page
    cy.get('[aria-label="Go to last page"]').click()
    cy.wait("@getTransactionsPage5")

    // On last page, next and last should be disabled
    cy.get('[aria-label="Go to next page"]').should("be.disabled")
    cy.get('[aria-label="Go to last page"]').should("be.disabled")
    cy.get('[aria-label="Go to previous page"]').should("not.be.disabled")
    cy.get('[aria-label="Go to first page"]').should("not.be.disabled")
  })

  it("should handle pagination with filters applied", () => {
    // Apply a filter first
    cy.selectDatePreset("today")
    cy.wait("@getTransactionsPage1")

    // Navigate to page 2
    cy.get('[aria-label="Go to page 2"]').click()
    cy.wait("@getTransactionsPage2")

    // Verify that the filter is maintained in the API call
    cy.wait("@getTransactionsPage2").then((interception) => {
      const url = new URL(interception.request.url)
      const params = url.searchParams

      expect(params.get("page")).to.equal("2")
      expect(params.has("startDate")).to.be.true
      expect(params.has("endDate")).to.be.true
    })
  })

  it("should reset to page 1 when filters change", () => {
    // Navigate to page 3 first
    cy.get('[aria-label="Go to page 3"]').click()
    cy.wait("@getTransactionsPage3")
    cy.get('[aria-current="page"]').should("contain", "3")

    // Apply a new filter
    cy.selectDatePreset("week")
    cy.wait("@getTransactionsPage1")

    // Verify we're back on page 1
    cy.get('[aria-current="page"]').should("contain", "1")
    cy.contains("Showing 1 to 10 of 47 results").should("be.visible")
  })

  it("should handle page size changes", () => {
    // Test changing page size if the component supports it
    cy.get("body").then(($body) => {
      if ($body.find('[data-testid*="page-size"], select').length > 0) {
        // Find and click page size selector
        cy.get('[data-testid*="page-size"], select').first().click()

        // Select a different page size (e.g., 20)
        cy.contains("20").click()

        // Verify the results per page changes
        cy.contains("Showing 1 to 20 of 47 results").should("be.visible")

        // Verify total pages is recalculated (47 items / 20 per page = 3 pages)
        cy.get('[aria-label="Go to page 3"]').should("be.visible")
        cy.get('[aria-label="Go to page 4"]').should("not.exist")
      }
    })
  })

  it("should handle empty state when no results", () => {
    // Mock empty results
    cy.intercept("GET", "/api/ach/transactions*", {
      statusCode: 200,
      body: {
        transactions: [],
        pagination: {
          total: 0,
          totalPages: 0,
          currentPage: 1,
          pageSize: 10,
        },
        metrics: {
          totalAmount: 0,
          totalCount: 0,
        },
      },
    }).as("getEmptyTransactions")

    // Apply a filter that returns no results
    cy.get('[data-testid="billing-filters"]').within(() => {
      cy.get('input[placeholder*="Search"]').type("nonexistent-transaction")
    })

    cy.wait("@getEmptyTransactions")

    // Verify pagination is hidden or shows appropriate empty state
    cy.get('[aria-label*="Go to page"]').should("not.exist")
    cy.contains("No results found").should("be.visible").or(cy.contains("0 results"))
  })

  it("should maintain pagination state during browser back/forward", () => {
    // Navigate to page 2
    cy.get('[aria-label="Go to page 2"]').click()
    cy.wait("@getTransactionsPage2")

    // Navigate to page 3
    cy.get('[aria-label="Go to page 3"]').click()
    cy.wait("@getTransactionsPage3")

    // Use browser back button
    cy.go("back")

    // Should be back on page 2
    cy.wait("@getTransactionsPage2")
    cy.get('[aria-current="page"]').should("contain", "2")

    // Use browser forward button
    cy.go("forward")

    // Should be back on page 3
    cy.wait("@getTransactionsPage3")
    cy.get('[aria-current="page"]').should("contain", "3")
  })

  it("should handle pagination with ellipsis for many pages", () => {
    // Mock a large dataset with many pages
    cy.intercept("GET", "/api/ach/transactions*", {
      statusCode: 200,
      body: {
        transactions: Array.from({ length: 10 }, (_, i) => ({
          id: `transaction-${i + 1}`,
          amount: (i + 1) * 100,
          status: "processed",
          created: "2023-03-15T10:00:00Z",
          customerName: `Customer ${i + 1}`,
          reference: `REF-${i + 1}`,
          direction: "credit",
        })),
        pagination: {
          total: 1000, // Large dataset
          totalPages: 100, // 100 pages
          currentPage: 50, // Current page in the middle
          pageSize: 10,
        },
        metrics: {
          totalAmount: 50000,
          totalCount: 10,
        },
      },
    }).as("getLargeDataset")

    cy.reload()
    cy.wait("@getLargeDataset")

    // Should show ellipsis (...) in pagination
    cy.contains("...").should("be.visible")

    // Should show first page, current page area, and last page
    cy.get('[aria-label="Go to page 1"]').should("be.visible")
    cy.get('[aria-label="Go to page 100"]').should("be.visible")
    cy.get('[aria-current="page"]').should("contain", "50")
  })
})
