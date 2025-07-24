/// <reference types="cypress" />
// ***********************************************
// This example commands.ts shows you how to
// create various custom commands and overwrite
// existing commands.
//
// For more comprehensive examples of custom
// commands please read more here:
// https://on.cypress.io/custom-commands
// ***********************************************

declare global {
  namespace Cypress {
    interface Chainable {
      login(email?: string, password?: string): Chainable<void>
      setupBillingPageInterceptors(): Chainable<void>
      waitForApiResponse(alias: string): Chainable<void>
      selectDatePreset(preset: string): Chainable<void>
      selectCustomDateRange(startDate: string, endDate: string): Chainable<void>
      navigateToPage(page: number): Chainable<void>
      checkStatusBadge(status: string): Chainable<void>
    }
  }
}

/**
 * Custom command to login (if authentication is required)
 */
Cypress.Commands.add("login", (email = "test@example.com", password = "password") => {
  // Implement login logic based on your authentication system
  cy.visit("/auth/signin")
  cy.get('input[name="email"]').type(email)
  cy.get('input[name="password"]').type(password)
  cy.get('button[type="submit"]').click()
  cy.url().should("not.include", "/auth/signin")
})

/**
 * Set up common API interceptors for billing page tests
 */
Cypress.Commands.add("setupBillingPageInterceptors", () => {
  // Mock transactions API response
  cy.intercept("GET", "/api/ach/transactions*", {
    statusCode: 200,
    body: {
      transactions: [
        {
          id: "test-1",
          amount: 100.0,
          status: "processed",
          created: "2023-03-15T10:00:00Z",
          customerName: "Test Customer 1",
          reference: "TEST-REF-001",
          direction: "credit",
        },
        {
          id: "test-2",
          amount: 250.5,
          status: "processing",
          created: "2023-03-16T14:30:00Z",
          customerName: "Test Customer 2",
          reference: "TEST-REF-002",
          direction: "debit",
        },
        {
          id: "test-3",
          amount: 75.25,
          status: "pending",
          created: "2023-03-17T09:15:00Z",
          customerName: "Test Customer 3",
          reference: "TEST-REF-003",
          direction: "credit",
        },
      ],
      pagination: {
        total: 50,
        totalPages: 5,
        currentPage: 1,
        pageSize: 10,
      },
      metrics: {
        totalAmount: 425.75,
        totalCount: 3,
      },
    },
  }).as("getTransactions")
})

/**
 * Wait for a specific API response
 */
Cypress.Commands.add("waitForApiResponse", (alias: string) => {
  cy.wait(`@${alias}`)
})

/**
 * Select a date preset from the dropdown
 */
Cypress.Commands.add("selectDatePreset", (preset: string) => {
  cy.get('[data-testid="date-range-select"]').click()
  cy.get(`[data-testid="date-range-option-${preset}"]`).click()
})

/**
 * Select a custom date range
 */
Cypress.Commands.add("selectCustomDateRange", (startDate: string, endDate: string) => {
  // Select custom range option
  cy.selectDatePreset("custom")

  // Open the custom date picker
  cy.get('[data-testid="custom-date-picker-trigger"]').click()

  // Select dates (this might need adjustment based on actual calendar implementation)
  cy.get('[data-testid="calendar"]').should("be.visible")

  // For now, we'll use a more generic approach
  cy.get('[data-testid="calendar"]').within(() => {
    // This will depend on your calendar implementation
    // You might need to click on specific date buttons
    cy.contains(startDate.split("-")[2]).first().click()
    cy.contains(endDate.split("-")[2]).last().click()
  })

  // Apply the selection
  cy.get('[data-testid="apply-custom-range"]').click()
})

/**
 * Navigate to a specific page in pagination
 */
Cypress.Commands.add("navigateToPage", (page: number) => {
  cy.get(`[aria-label="Go to page ${page}"]`).click()
})

/**
 * Check that a status badge shows the correct status
 */
Cypress.Commands.add("checkStatusBadge", (status: string) => {
  cy.get(`[data-testid="status-badge-${status}"]`).should("be.visible")
})

export {}
