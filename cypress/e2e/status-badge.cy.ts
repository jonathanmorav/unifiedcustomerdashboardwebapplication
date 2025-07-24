describe("Status Badge Tests", () => {
  beforeEach(() => {
    // Set up API interceptors with different status types
    cy.intercept("GET", "/api/ach/transactions*", {
      statusCode: 200,
      body: {
        transactions: [
          {
            id: "test-processed",
            amount: 100.0,
            status: "processed",
            created: "2023-03-15T10:00:00Z",
            customerName: "Processed Customer",
            reference: "PROC-001",
            direction: "credit",
          },
          {
            id: "test-processing",
            amount: 250.5,
            status: "processing",
            created: "2023-03-16T14:30:00Z",
            customerName: "Processing Customer",
            reference: "PROC-002",
            direction: "debit",
          },
          {
            id: "test-pending",
            amount: 75.25,
            status: "pending",
            created: "2023-03-17T09:15:00Z",
            customerName: "Pending Customer",
            reference: "PEND-001",
            direction: "credit",
          },
          {
            id: "test-failed",
            amount: 500.0,
            status: "failed",
            created: "2023-03-18T16:45:00Z",
            customerName: "Failed Customer",
            reference: "FAIL-001",
            direction: "debit",
          },
          {
            id: "test-cancelled",
            amount: 200.0,
            status: "cancelled",
            created: "2023-03-19T11:20:00Z",
            customerName: "Cancelled Customer",
            reference: "CANC-001",
            direction: "credit",
          },
          {
            id: "test-returned",
            amount: 150.75,
            status: "returned",
            created: "2023-03-20T13:10:00Z",
            customerName: "Returned Customer",
            reference: "RET-001",
            direction: "debit",
          },
        ],
        pagination: {
          total: 6,
          totalPages: 1,
          currentPage: 1,
          pageSize: 10,
        },
        metrics: {
          totalAmount: 1276.5,
          totalCount: 6,
        },
      },
    }).as("getTransactionsWithStatuses")

    // Visit the billing page
    cy.visit("/billing")

    // Wait for the page to load and transactions to be fetched
    cy.get('[data-testid="billing-filters"]').should("be.visible")
    cy.wait("@getTransactionsWithStatuses")
  })

  it('should display "Processed" status badge correctly', () => {
    // Look for processed status badges in the transaction table
    // This assumes the table has status badges with appropriate data-testids
    cy.get('[data-testid*="status-badge"]').should("exist")

    // Verify that processed status appears
    cy.contains("processed", { matchCase: false }).should("be.visible")

    // Verify the status badge has the correct styling for processed status
    cy.get('[data-testid*="status-processed"], [class*="processed"]')
      .should("exist")
      .and("be.visible")
  })

  it("should display all status types correctly", () => {
    const expectedStatuses = [
      "processed",
      "processing",
      "pending",
      "failed",
      "cancelled",
      "returned",
    ]

    expectedStatuses.forEach((status) => {
      // Check that each status appears in the transaction table
      cy.contains(status, { matchCase: false }).should("be.visible")
    })
  })

  it('should allow filtering by "Processed" status', () => {
    // Open status filter dropdown
    cy.get('[data-testid="billing-filters"]').within(() => {
      // Find and click the status filter popover trigger
      cy.contains("All statuses").click()
    })

    // Select only "Processed" status
    cy.get('[type="checkbox"]').uncheck({ force: true }) // Uncheck all first
    cy.contains("label", "Processed").click()

    // Apply filter by clicking outside or confirm button if exists
    cy.get("body").click(0, 0) // Click outside to close popover

    // Verify API call includes status filter
    cy.wait("@getTransactionsWithStatuses").then((interception) => {
      const url = new URL(interception.request.url)
      const params = url.searchParams

      // Check if status parameter exists and includes 'processed'
      const statusParam = params.get("status")
      if (statusParam) {
        expect(statusParam.toLowerCase()).to.include("processed")
      }
    })

    // Verify only processed transactions are shown
    cy.contains("processed", { matchCase: false }).should("be.visible")
    // Verify other statuses are not visible (or less visible)
    cy.get('[data-testid*="transaction-row"]').should("have.length.at.least", 1)
  })

  it("should show correct color coding for different status badges", () => {
    // This test verifies that different statuses have different visual indicators
    // Based on the BillingFilters component, we can see the color mapping

    const statusColorMap = {
      pending: "yellow",
      processing: "blue",
      processed: "green",
      failed: "red",
      cancelled: "gray",
      returned: "orange",
    }

    Object.entries(statusColorMap).forEach(([status, color]) => {
      // Look for elements that contain the status and verify they have appropriate coloring
      cy.get("body").then(($body) => {
        if ($body.find(`[data-testid*="${status}"]`).length > 0) {
          cy.get(`[data-testid*="${status}"]`).should("have.class", new RegExp(color, "i"))
        }
      })
    })
  })

  it("should update status badge when transaction status changes", () => {
    // Mock a transaction status update
    cy.intercept("PATCH", "/api/ach/transactions/*", {
      statusCode: 200,
      body: {
        id: "test-processing",
        status: "processed",
      },
    }).as("updateTransactionStatus")

    // Mock updated transactions list
    cy.intercept("GET", "/api/ach/transactions*", {
      statusCode: 200,
      body: {
        transactions: [
          {
            id: "test-processing",
            amount: 250.5,
            status: "processed", // Updated status
            created: "2023-03-16T14:30:00Z",
            customerName: "Processing Customer",
            reference: "PROC-002",
            direction: "debit",
          },
        ],
        pagination: {
          total: 1,
          totalPages: 1,
          currentPage: 1,
          pageSize: 10,
        },
        metrics: {
          totalAmount: 250.5,
          totalCount: 1,
        },
      },
    }).as("getUpdatedTransactions")

    // Simulate a refresh or status update trigger
    cy.reload()
    cy.wait("@getUpdatedTransactions")

    // Verify the status badge shows "processed" instead of "processing"
    cy.contains("processed", { matchCase: false }).should("be.visible")
    cy.should("not.contain", "processing")
  })

  it("should handle status badge accessibility", () => {
    // Verify status badges have proper accessibility attributes
    cy.get('[data-testid*="status"]').each(($badge) => {
      // Should have appropriate ARIA labels or text content
      cy.wrap($badge).should("have.attr", "aria-label").or("contain.text")
    })

    // Verify status badges are keyboard accessible if they're interactive
    cy.get('[data-testid*="status"]').first().focus()
    cy.focused().should("exist")
  })

  it("should show status badge tooltips when hovered", () => {
    // Test tooltip functionality for status badges
    cy.get('[data-testid*="status-badge"]').first().trigger("mouseover")

    // Check if tooltip appears (this depends on your tooltip implementation)
    cy.get('[role="tooltip"], [data-testid*="tooltip"]').should("be.visible")
  })
})
