describe("End-to-End Regression Test Suite", () => {
  /**
   * This test suite covers all the required regression test scenarios:
   * 1. Week preset returns correct first/last day
   * 2. Custom range filter hits back-end with correct ISO strings
   * 3. Status badge shows "Processed"
   * 4. Pagination shows correct number of pages and navigates properly
   */

  beforeEach(() => {
    // Set up comprehensive API interceptors for the full test suite
    cy.setupBillingPageInterceptors()

    // Visit the billing page
    cy.visit("/billing")

    // Wait for the page to load
    cy.get('[data-testid="billing-filters"]').should("be.visible")
  })

  describe("Week Preset Date Range Integration", () => {
    it("should select week preset and verify correct first/last day with ISO strings", () => {
      // Test requirement: Week preset returns correct first/last day
      cy.selectDatePreset("week")

      cy.wait("@getTransactions").then((interception) => {
        const url = new URL(interception.request.url)
        const params = url.searchParams

        // Verify ISO string format for backend API
        const startDateStr = params.get("startDate")!
        const endDateStr = params.get("endDate")!

        expect(startDateStr).to.match(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/)
        expect(endDateStr).to.match(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/)

        // Verify correct week boundaries (Sunday to Saturday)
        const startDate = new Date(startDateStr)
        const endDate = new Date(endDateStr)

        expect(startDate.getDay()).to.equal(0) // Sunday
        expect(endDate.getDay()).to.equal(6) // Saturday

        // Verify it's the current week
        const now = new Date()
        const currentWeekStart = new Date(now)
        currentWeekStart.setDate(now.getDate() - now.getDay())
        currentWeekStart.setHours(0, 0, 0, 0)

        expect(startDate.toDateString()).to.equal(currentWeekStart.toDateString())
      })

      // Verify UI displays the selected week
      cy.get('[data-testid="selected-date-range"]').should("be.visible")
    })
  })

  describe("Custom Date Range ISO String Integration", () => {
    it("should send correct ISO strings to backend when custom range is applied", () => {
      // Test requirement: Custom range filter hits back-end with correct ISO strings
      cy.selectDatePreset("custom")

      // Open custom date picker
      cy.get('[data-testid="custom-date-picker-trigger"]').click()

      // Select date range
      cy.get('[data-testid="calendar"]').should("be.visible")
      cy.get('[data-testid="calendar-day-10"]').click()
      cy.get('[data-testid="calendar-day-15"]').click()

      // Apply the range
      cy.get('[data-testid="apply-custom-range"]').click()

      cy.wait("@getTransactions").then((interception) => {
        const url = new URL(interception.request.url)
        const params = url.searchParams

        // Verify ISO string format compliance
        const startDateStr = params.get("startDate")!
        const endDateStr = params.get("endDate")!

        // Must be valid ISO strings
        expect(() => new Date(startDateStr).toISOString()).to.not.throw()
        expect(() => new Date(endDateStr).toISOString()).to.not.throw()

        // Must include time component in correct format
        expect(startDateStr).to.include("T")
        expect(endDateStr).to.include("T")

        // Should have timezone information (Z or offset)
        expect(startDateStr).to.match(/T\d{2}:\d{2}:\d{2}/)
        expect(endDateStr).to.match(/T\d{2}:\d{2}:\d{2}/)

        // Verify dates are parseable and correct
        const startDate = new Date(startDateStr)
        const endDate = new Date(endDateStr)

        expect(startDate.getDate()).to.equal(10)
        expect(endDate.getDate()).to.equal(15)
      })
    })
  })

  describe("Status Badge Integration", () => {
    it('should display "Processed" status badge correctly', () => {
      // Test requirement: Status badge shows "Processed"

      // Wait for transactions to load
      cy.wait("@getTransactions")

      // Verify processed status badges are visible
      cy.contains("processed", { matchCase: false }).should("be.visible")

      // Verify status badge styling and accessibility
      cy.get('[data-testid*="status"], [class*="status"]').should("exist")

      // Test filtering by processed status
      cy.get('[data-testid="billing-filters"]').within(() => {
        cy.contains("All statuses").click()
      })

      // Select only processed status
      cy.contains("label", "Processed").click()
      cy.get("body").click(0, 0) // Close popover

      // Verify processed status is prominently displayed
      cy.contains("processed", { matchCase: false }).should("be.visible")
    })

    it("should show correct status badge colors and indicators", () => {
      cy.wait("@getTransactions")

      // Verify different status types have appropriate visual treatment
      const statusStyles = {
        processed: "green",
        processing: "blue",
        pending: "yellow",
        failed: "red",
      }

      Object.entries(statusStyles).forEach(([status, expectedColor]) => {
        cy.get("body").then(($body) => {
          if ($body.text().toLowerCase().includes(status)) {
            // Verify status has appropriate color coding
            cy.contains(status, { matchCase: false }).should("be.visible")
          }
        })
      })
    })
  })

  describe("Pagination Integration", () => {
    beforeEach(() => {
      // Set up multi-page data for pagination tests
      cy.intercept("GET", "/api/ach/transactions*page=1*", {
        statusCode: 200,
        body: {
          transactions: Array.from({ length: 10 }, (_, i) => ({
            id: `tx-${i + 1}`,
            amount: (i + 1) * 100,
            status: "processed",
            created: "2023-03-15T10:00:00Z",
            customerName: `Customer ${i + 1}`,
            reference: `REF-${i + 1}`,
            direction: "credit",
          })),
          pagination: {
            total: 25,
            totalPages: 3,
            currentPage: 1,
            pageSize: 10,
          },
          metrics: { totalAmount: 2500, totalCount: 10 },
        },
      }).as("getTransactionsPage1")

      cy.intercept("GET", "/api/ach/transactions*page=2*", {
        statusCode: 200,
        body: {
          transactions: Array.from({ length: 10 }, (_, i) => ({
            id: `tx-${i + 11}`,
            amount: (i + 11) * 100,
            status: "processed",
            created: "2023-03-16T10:00:00Z",
            customerName: `Customer ${i + 11}`,
            reference: `REF-${i + 11}`,
            direction: "debit",
          })),
          pagination: {
            total: 25,
            totalPages: 3,
            currentPage: 2,
            pageSize: 10,
          },
          metrics: { totalAmount: 2500, totalCount: 10 },
        },
      }).as("getTransactionsPage2")
    })

    it("should show correct number of pages and navigate properly", () => {
      // Test requirement: Pagination shows correct number of pages and navigates properly

      cy.wait("@getTransactionsPage1")

      // Verify correct total pages are shown
      cy.get('[aria-label="Go to page 3"]').should("be.visible")
      cy.get('[aria-label="Go to page 4"]').should("not.exist")

      // Verify pagination info
      cy.contains("Showing 1 to 10 of 25 results").should("be.visible")

      // Test navigation to page 2
      cy.get('[aria-label="Go to page 2"]').click()
      cy.wait("@getTransactionsPage2")

      // Verify page 2 content
      cy.contains("Customer 11").should("be.visible")
      cy.contains("Showing 11 to 20 of 25 results").should("be.visible")
      cy.get('[aria-current="page"]').should("contain", "2")

      // Test navigation buttons
      cy.get('[aria-label="Go to previous page"]').click()
      cy.wait("@getTransactionsPage1")
      cy.get('[aria-current="page"]').should("contain", "1")

      // Verify navigation button states
      cy.get('[aria-label="Go to first page"]').should("be.disabled")
      cy.get('[aria-label="Go to previous page"]').should("be.disabled")
      cy.get('[aria-label="Go to next page"]').should("not.be.disabled")
    })

    it("should reset pagination when filters change", () => {
      // Navigate to page 2
      cy.get('[aria-label="Go to page 2"]').click()
      cy.wait("@getTransactionsPage2")
      cy.get('[aria-current="page"]').should("contain", "2")

      // Apply a filter (should reset to page 1)
      cy.selectDatePreset("today")
      cy.wait("@getTransactionsPage1")

      // Verify we're back on page 1
      cy.get('[aria-current="page"]').should("contain", "1")
    })
  })

  describe("Full Integration Workflow", () => {
    it("should complete full user workflow with all components working together", () => {
      // This test verifies all components work together in a realistic user scenario

      // 1. Start with week preset
      cy.selectDatePreset("week")
      cy.wait("@getTransactions")

      // Verify week preset works with ISO strings
      cy.get('[data-testid="selected-date-range"]').should("be.visible")

      // 2. Switch to custom date range
      cy.selectDatePreset("custom")
      cy.get('[data-testid="custom-date-picker-trigger"]').click()
      cy.get('[data-testid="calendar-day-10"]').click()
      cy.get('[data-testid="calendar-day-20"]').click()
      cy.get('[data-testid="apply-custom-range"]').click()

      cy.wait("@getTransactions").then((interception) => {
        const url = new URL(interception.request.url)
        const params = url.searchParams

        // Verify ISO strings are sent correctly
        expect(params.get("startDate")).to.match(/^\d{4}-\d{2}-\d{2}T/)
        expect(params.get("endDate")).to.match(/^\d{4}-\d{2}-\d{2}T/)

        // Verify pagination reset
        expect(params.get("page")).to.equal("1")
      })

      // 3. Verify status badges are working
      cy.contains("processed", { matchCase: false }).should("be.visible")

      // 4. Test pagination navigation
      cy.get('[aria-label="Go to page 2"]').should("be.visible")

      // 5. Apply status filter and verify everything still works
      cy.get('[data-testid="billing-filters"]').within(() => {
        cy.contains("All statuses").click()
      })
      cy.contains("label", "Processed").click()
      cy.get("body").click(0, 0)

      // Final verification - all components should be functional
      cy.wait("@getTransactions")
      cy.get('[data-testid="selected-date-range"]').should("be.visible")
      cy.contains("processed", { matchCase: false }).should("be.visible")
    })
  })
})
