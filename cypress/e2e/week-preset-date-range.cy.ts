describe("Week Preset Date Range Tests", () => {
  beforeEach(() => {
    // Set up API interceptors
    cy.setupBillingPageInterceptors()

    // Visit the billing page
    cy.visit("/billing")

    // Wait for the page to load
    cy.get('[data-testid="billing-filters"]').should("be.visible")
  })

  it("should return correct first and last day when selecting week preset", () => {
    // Intercept the API call to verify the date parameters
    cy.intercept("GET", "/api/ach/transactions*", (req) => {
      expect(req.url).to.contain("startDate")
      expect(req.url).to.contain("endDate")
    }).as("getTransactionsWithDates")

    // Select week preset
    cy.selectDatePreset("week")

    // Wait for API call and verify date parameters
    cy.wait("@getTransactionsWithDates").then((interception) => {
      const url = new URL(interception.request.url)
      const params = url.searchParams

      // Verify start and end dates are present
      expect(params.has("startDate")).to.be.true
      expect(params.has("endDate")).to.be.true

      const startDate = new Date(params.get("startDate")!)
      const endDate = new Date(params.get("endDate")!)

      // Verify it's the current week (Sunday to Saturday by default)
      const now = new Date()
      const startOfCurrentWeek = new Date(now)
      const endOfCurrentWeek = new Date(now)

      // Calculate start of week (Sunday = 0)
      const dayOfWeek = startOfCurrentWeek.getDay()
      startOfCurrentWeek.setDate(startOfCurrentWeek.getDate() - dayOfWeek)
      startOfCurrentWeek.setHours(0, 0, 0, 0)

      // Calculate end of week (Saturday)
      endOfCurrentWeek.setDate(startOfCurrentWeek.getDate() + 6)
      endOfCurrentWeek.setHours(23, 59, 59, 999)

      // Verify the dates match the current week
      expect(startDate.toDateString()).to.equal(startOfCurrentWeek.toDateString())
      expect(endDate.toDateString()).to.equal(endOfCurrentWeek.toDateString())

      // Verify the start is Sunday and end is Saturday
      expect(startDate.getDay()).to.equal(0) // Sunday
      expect(endDate.getDay()).to.equal(6) // Saturday
    })

    // Verify the selected date range is displayed
    cy.get('[data-testid="selected-date-range"]').should("be.visible")
  })

  it("should handle week preset with different weekStartsOn values", () => {
    // This test verifies that the week preset correctly handles different week start days
    // Since the component uses weekStartsOn: 0 (Sunday), we verify this behavior

    cy.selectDatePreset("week")

    cy.wait("@getTransactions").then((interception) => {
      const url = new URL(interception.request.url)
      const params = url.searchParams

      const startDate = new Date(params.get("startDate")!)
      const endDate = new Date(params.get("endDate")!)

      // Verify week starts on Sunday (day 0) and ends on Saturday (day 6)
      expect(startDate.getDay()).to.equal(0)
      expect(endDate.getDay()).to.equal(6)

      // Verify it's exactly 7 days
      const diffTime = Math.abs(endDate.getTime() - startDate.getTime())
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
      expect(diffDays).to.equal(6) // 6 full days difference (Sunday to Saturday inclusive)
    })
  })

  it("should maintain week preset selection when switching between presets", () => {
    // First select week preset
    cy.selectDatePreset("week")
    cy.wait("@getTransactions")

    // Store the week date range
    cy.get('[data-testid="selected-date-range"]').invoke("text").as("weekRange")

    // Switch to another preset
    cy.selectDatePreset("today")
    cy.wait("@getTransactions")

    // Switch back to week
    cy.selectDatePreset("week")
    cy.wait("@getTransactions")

    // Verify the week range is recalculated (should be the same as before)
    cy.get("@weekRange").then((originalRange) => {
      cy.get('[data-testid="selected-date-range"]').should("contain.text", originalRange as unknown as string)
    })
  })

  it("should reset pagination to page 1 when week preset is selected", () => {
    // First, simulate being on a different page
    cy.intercept("GET", "/api/ach/transactions*page=2*", {
      statusCode: 200,
      body: {
        transactions: [],
        pagination: { total: 50, totalPages: 5, currentPage: 2, pageSize: 10 },
        metrics: { totalAmount: 0, totalCount: 0 },
      },
    }).as("getTransactionsPage2")

    // Select week preset
    cy.selectDatePreset("week")

    // Verify API call includes page=1
    cy.wait("@getTransactions").then((interception) => {
      const url = new URL(interception.request.url)
      const params = url.searchParams

      // Should reset to page 1 when changing date preset
      expect(params.get("page")).to.equal("1")
    })
  })

  it("should generate ISO string dates for week preset API calls", () => {
    cy.selectDatePreset("week")

    cy.wait("@getTransactions").then((interception) => {
      const url = new URL(interception.request.url)
      const params = url.searchParams

      const startDateStr = params.get("startDate")!
      const endDateStr = params.get("endDate")!

      // Verify the dates are valid ISO strings
      expect(() => new Date(startDateStr).toISOString()).to.not.throw()
      expect(() => new Date(endDateStr).toISOString()).to.not.throw()

      // Verify the format is ISO-like (contains T and Z or timezone info)
      expect(startDateStr).to.match(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/)
      expect(endDateStr).to.match(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/)
    })
  })
})
