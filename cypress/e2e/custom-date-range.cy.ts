describe("Custom Date Range Filter", () => {
  beforeEach(() => {
    // Mock the API response
    cy.intercept("GET", "/api/ach/transactions*", {
      statusCode: 200,
      body: {
        transactions: [
          {
            id: "test-1",
            amount: 100.0,
            status: "completed",
            created: "2023-03-15T10:00:00Z",
            customerName: "Test Customer",
            reference: "TEST-REF-001",
          },
        ],
        pagination: {
          total: 1,
          totalPages: 1,
          currentPage: 1,
        },
        metrics: {
          totalAmount: 100.0,
          totalCount: 1,
        },
      },
    }).as("getTransactions")

    // Visit the billing page (assuming it's the main page with the filters)
    cy.visit("/billing")

    // Wait for the page to load
    cy.get('[data-testid=\"billing-filters\"]').should("be.visible")
  })

  it("should allow user to select custom date range and verify query parameters", () => {
    // Step 1: Select Custom Range from dropdown
    cy.get('[data-testid="date-range-select"]').click()
    cy.get('[data-testid="date-range-option-custom"]').click()

    // Step 2: Verify custom date picker appears
    cy.get('[data-testid="custom-date-picker-trigger"]').should("be.visible")
    cy.get('[data-testid="custom-date-picker-trigger"]').should(
      "contain",
      "Select custom date range"
    )

    // Step 3: Open the calendar
    cy.get('[data-testid="custom-date-picker-trigger"]').click()

    // Step 4: Verify Apply button is initially disabled
    cy.get('[data-testid="apply-custom-range"]').should("be.disabled")

    // Step 5: Select start date (March 10, 2023)
    // Note: This assumes the calendar shows March 2023
    cy.get('[data-testid="calendar"]').should("be.visible")
    cy.get('[data-testid="calendar-day-10"]').click()

    // Step 6: Select end date (March 20, 2023)
    cy.get('[data-testid="calendar-day-20"]').click()

    // Step 7: Verify Apply button is now enabled
    cy.get('[data-testid="apply-custom-range"]').should("not.be.disabled")

    // Step 8: Click Apply
    cy.get('[data-testid="apply-custom-range"]').click()

    // Step 9: Verify the API call includes the correct date parameters
    cy.wait("@getTransactions").then((interception) => {
      const url = new URL(interception.request.url)
      const params = url.searchParams

      // Check that startDate and endDate are present in the query string
      expect(params.has("startDate")).to.be.true
      expect(params.has("endDate")).to.be.true

      // Verify the dates are valid ISO strings
      const startDateStr = params.get("startDate")!
      const endDateStr = params.get("endDate")!

      // Validate ISO string format
      expect(() => new Date(startDateStr).toISOString()).to.not.throw()
      expect(() => new Date(endDateStr).toISOString()).to.not.throw()

      // Verify the format matches ISO pattern (YYYY-MM-DDTHH:mm:ss)
      expect(startDateStr).to.match(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/)
      expect(endDateStr).to.match(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/)

      // Parse the dates and verify they are correct
      const startDate = new Date(startDateStr)
      const endDate = new Date(endDateStr)

      expect(startDate.getDate()).to.equal(10)
      expect(startDate.getMonth()).to.equal(2) // March (0-indexed)
      expect(startDate.getFullYear()).to.equal(2023)

      expect(endDate.getDate()).to.equal(20)
      expect(endDate.getMonth()).to.equal(2) // March (0-indexed)
      expect(endDate.getFullYear()).to.equal(2023)

      // Verify pagination reset
      expect(params.get("page")).to.equal("1")
    })

    // Step 10: Verify the date range is displayed correctly
    cy.get('[data-testid="selected-date-range"]').should("contain", "Mar 10, 2023 - Mar 20, 2023")

    // Step 11: Verify the custom date picker button shows the selected range
    cy.get('[data-testid="custom-date-picker-trigger"]').should(
      "contain",
      "Mar 10, 2023 - Mar 20, 2023"
    )
  })

  it("should maintain custom dates when switching between custom and other presets", () => {
    // Set up custom date range first
    cy.get('[data-testid=\"date-range-select\"]').click()
    cy.get('[data-testid=\"date-range-option-custom\"]').click()

    cy.get('[data-testid=\"custom-date-picker-trigger\"]').click()
    cy.get('[data-testid=\"calendar-day-10\"]').click()
    cy.get('[data-testid=\"calendar-day-20\"]').click()
    cy.get('[data-testid=\"apply-custom-range\"]').click()

    // Verify custom range is set
    cy.get('[data-testid=\"selected-date-range\"]').should("contain", "Mar 10, 2023 - Mar 20, 2023")

    // Switch to a different preset
    cy.get('[data-testid=\"date-range-select\"]').click()
    cy.get('[data-testid=\"date-range-option-today\"]').click()

    // Wait for API call to complete
    cy.wait("@getTransactions")

    // Switch back to custom
    cy.get('[data-testid=\"date-range-select\"]').click()
    cy.get('[data-testid=\"date-range-option-custom\"]').click()

    // Verify the custom dates are preserved
    cy.get('[data-testid=\"custom-date-picker-trigger\"]').should(
      "contain",
      "Mar 10, 2023 - Mar 20, 2023"
    )
  })

  it("should clear custom date range when Clear button is clicked", () => {
    // Set up custom date range
    cy.get('[data-testid=\"date-range-select\"]').click()
    cy.get('[data-testid=\"date-range-option-custom\"]').click()

    cy.get('[data-testid=\"custom-date-picker-trigger\"]').click()
    cy.get('[data-testid=\"calendar-day-10\"]').click()
    cy.get('[data-testid=\"calendar-day-20\"]').click()
    cy.get('[data-testid=\"apply-custom-range\"]').click()

    // Verify range is set
    cy.get('[data-testid=\"selected-date-range\"]').should("contain", "Mar 10, 2023 - Mar 20, 2023")

    // Open calendar again and clear
    cy.get('[data-testid=\"custom-date-picker-trigger\"]').click()
    cy.get('[data-testid=\"clear-custom-range\"]').click()

    // Verify range is cleared
    cy.get('[data-testid=\"custom-date-picker-trigger\"]').should(
      "contain",
      "Select custom date range"
    )
    cy.get('[data-testid=\"selected-date-range\"]').should("not.exist")
  })

  it("should reset page to 1 when applying custom date range", () => {
    // First, simulate being on page 2
    cy.intercept("GET", "/api/ach/transactions*page=2*", {
      statusCode: 200,
      body: {
        transactions: [],
        pagination: { total: 100, totalPages: 5, currentPage: 2 },
        metrics: {},
      },
    }).as("getTransactionsPage2")

    // Navigate to page 2 somehow (this would depend on your pagination implementation)
    // For now, we'll just verify that when we apply a custom range, page gets reset

    // Set up custom date range
    cy.get('[data-testid=\"date-range-select\"]').click()
    cy.get('[data-testid=\"date-range-option-custom\"]').click()

    cy.get('[data-testid=\"custom-date-picker-trigger\"]').click()
    cy.get('[data-testid=\"calendar-day-10\"]').click()
    cy.get('[data-testid=\"calendar-day-20\"]').click()
    cy.get('[data-testid=\"apply-custom-range\"]').click()

    // Verify the API call has page=1
    cy.wait("@getTransactions").then((interception) => {
      const url = new URL(interception.request.url)
      const params = url.searchParams
      expect(params.get("page")).to.equal("1")
    })
  })

  it("should disable future dates in calendar", () => {
    cy.get('[data-testid=\"date-range-select\"]').click()
    cy.get('[data-testid=\"date-range-option-custom\"]').click()

    cy.get('[data-testid=\"custom-date-picker-trigger\"]').click()

    // Try to click on a future date (assuming we're in March 2023, try April 1)
    // This would depend on how your calendar component handles disabled dates
    cy.get('[data-testid=\"calendar\"]').should("be.visible")

    // Navigate to next month if needed and verify future dates are disabled
    cy.get('[data-testid=\"calendar-next-month\"]').click()
    cy.get('[data-testid=\"calendar-day-1\"]').should("have.attr", "aria-disabled", "true")
  })

  it("should handle edge case: same start and end date", () => {
    cy.get('[data-testid=\"date-range-select\"]').click()
    cy.get('[data-testid=\"date-range-option-custom\"]').click()

    cy.get('[data-testid=\"custom-date-picker-trigger\"]').click()

    // Click the same date twice (should select it as both start and end)
    cy.get('[data-testid=\"calendar-day-15\"]').click()
    cy.get('[data-testid=\"calendar-day-15\"]').click()

    cy.get('[data-testid=\"apply-custom-range\"]').should("not.be.disabled")
    cy.get('[data-testid=\"apply-custom-range\"]').click()

    // Verify API call
    cy.wait("@getTransactions").then((interception) => {
      const url = new URL(interception.request.url)
      const params = url.searchParams

      const startDate = new Date(params.get("startDate")!)
      const endDate = new Date(params.get("endDate")!)

      // Both dates should be March 15
      expect(startDate.getDate()).to.equal(15)
      expect(endDate.getDate()).to.equal(15)
    })
  })
})
