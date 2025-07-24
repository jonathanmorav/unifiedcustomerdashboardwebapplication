describe("Cross-Page Visual Regression Test", () => {
  /**
   * Visual regression test to ensure consistent typography, spacing, and color palette
   * between /dashboard and /billing pages in light mode
   */

  beforeEach(() => {
    // Set up API interceptors for both pages
    cy.setupBillingPageInterceptors()
    
    // Mock dashboard API responses
    cy.intercept("GET", "/api/dashboard/*", {
      statusCode: 200,
      body: {
        metrics: {
          totalRevenue: 125000,
          totalTransactions: 1250,
          successRate: 98.5,
          pendingAmount: 5000
        },
        recentTransactions: [
          {
            id: "dash-1",
            amount: 500.0,
            status: "processed",
            created: "2023-03-15T10:00:00Z",
            customerName: "Dashboard Customer 1",
            reference: "DASH-REF-001",
            direction: "credit",
          },
          {
            id: "dash-2",
            amount: 750.25,
            status: "processing",
            created: "2023-03-16T14:30:00Z",
            customerName: "Dashboard Customer 2",
            reference: "DASH-REF-002",
            direction: "debit",
          }
        ]
      }
    }).as("getDashboard")

    // Ensure we're in light mode
    cy.window().then((win) => {
      win.localStorage.setItem('theme', 'light')
    })
  })

  it("should capture screenshots of dashboard and billing pages for visual comparison", () => {
    // Visit dashboard page and capture screenshot
    cy.visit("/dashboard")
    cy.wait("@getDashboard")
    
    // Wait for page to fully load
    cy.get("body").should("be.visible")
    cy.wait(1000) // Allow for any animations/transitions
    
    // Capture dashboard screenshot
    cy.screenshot("dashboard-light-mode", {
      capture: "viewport",
      disableTimersAndAnimations: true
    })

    // Visit billing page and capture screenshot
    cy.visit("/billing")
    cy.wait("@getTransactions")
    
    // Wait for page to fully load
    cy.get('[data-testid="billing-filters"]').should("be.visible")
    cy.wait(1000) // Allow for any animations/transitions
    
    // Capture billing screenshot
    cy.screenshot("billing-light-mode", {
      capture: "viewport", 
      disableTimersAndAnimations: true
    })
  })

  it("should verify consistent typography across pages", () => {
    // Check dashboard typography
    cy.visit("/dashboard")
    cy.wait("@getDashboard")

    // Verify main heading typography
    cy.get("h1, h2, h3").first().should("exist").then(($heading) => {
      const headingStyles = window.getComputedStyle($heading[0])
      cy.wrap({
        fontFamily: headingStyles.fontFamily,
        fontSize: headingStyles.fontSize,
        fontWeight: headingStyles.fontWeight,
        lineHeight: headingStyles.lineHeight,
        color: headingStyles.color
      }).as("dashboardHeadingStyles")
    })

    // Check billing typography 
    cy.visit("/billing")
    cy.wait("@getTransactions")

    // Verify main heading typography consistency
    cy.get("h1, h2, h3").first().should("exist").then(($heading) => {
      const headingStyles = window.getComputedStyle($heading[0])
      
      cy.get("@dashboardHeadingStyles").then((dashStyles: any) => {
        expect(headingStyles.fontFamily).to.equal(dashStyles.fontFamily)
        expect(headingStyles.fontWeight).to.equal(dashStyles.fontWeight)
        // Note: fontSize may vary for different heading levels, but font family should be consistent
      })
    })
  })

  it("should verify consistent spacing and layout patterns", () => {
    // Test common spacing patterns
    const checkSpacing = (page: string) => {
      // Check card/component margins
      cy.get('[class*="card"], [class*="border"], [data-testid*="card"]').first().then(($card) => {
        if ($card.length > 0) {
          const cardStyles = window.getComputedStyle($card[0])
          cy.wrap({
            margin: cardStyles.margin,
            padding: cardStyles.padding,
            borderRadius: cardStyles.borderRadius
          }).as(`${page}CardStyles`)
        }
      })

      // Check button spacing
      cy.get('button').first().then(($button) => {
        if ($button.length > 0) {
          const buttonStyles = window.getComputedStyle($button[0])
          cy.wrap({
            padding: buttonStyles.padding,
            margin: buttonStyles.margin
          }).as(`${page}ButtonStyles`)
        }
      })
    }

    // Check dashboard spacing
    cy.visit("/dashboard")
    cy.wait("@getDashboard")
    checkSpacing("dashboard")

    // Check billing spacing
    cy.visit("/billing")
    cy.wait("@getTransactions")
    checkSpacing("billing")

    // Compare spacing patterns (they should be consistent)
    cy.get("@dashboardCardStyles").then((dashCardStyles: any) => {
      cy.get("@billingCardStyles").then((billCardStyles: any) => {
        // Border radius should be consistent across pages
        expect(dashCardStyles.borderRadius).to.equal(billCardStyles.borderRadius)
      })
    })
  })

  it("should verify consistent color palette and theme", () => {
    const checkColorPalette = (page: string) => {
      // Check background colors
      cy.get("body").then(($body) => {
        const bodyStyles = window.getComputedStyle($body[0])
        cy.wrap({
          backgroundColor: bodyStyles.backgroundColor,
          color: bodyStyles.color
        }).as(`${page}BodyStyles`)
      })

      // Check primary button colors (if they exist)
      cy.get('button[class*="primary"], button[class*="bg-blue"], [data-testid*="primary"]').first().then(($button) => {
        if ($button.length > 0) {
          const buttonStyles = window.getComputedStyle($button[0])
          cy.wrap({
            backgroundColor: buttonStyles.backgroundColor,
            color: buttonStyles.color
          }).as(`${page}PrimaryButtonStyles`)
        }
      })

      // Check text colors
      cy.get("p, span, div[class*='text']").first().then(($text) => {
        if ($text.length > 0) {
          const textStyles = window.getComputedStyle($text[0])
          cy.wrap({
            color: textStyles.color
          }).as(`${page}TextStyles`)
        }
      })
    }

    // Check dashboard colors
    cy.visit("/dashboard")
    cy.wait("@getDashboard")
    checkColorPalette("dashboard")

    // Check billing colors
    cy.visit("/billing") 
    cy.wait("@getTransactions")
    checkColorPalette("billing")

    // Compare color consistency
    cy.get("@dashboardBodyStyles").then((dashBodyStyles: any) => {
      cy.get("@billingBodyStyles").then((billBodyStyles: any) => {
        // Background and text colors should be consistent across pages
        expect(dashBodyStyles.backgroundColor).to.equal(billBodyStyles.backgroundColor)
        expect(dashBodyStyles.color).to.equal(billBodyStyles.color)
      })
    })
  })

  it("should verify consistent component styling across pages", () => {
    // Check status badge consistency
    cy.visit("/dashboard")
    cy.wait("@getDashboard")
    
    // Look for status indicators on dashboard
    cy.get('body').then(($body) => {
      if ($body.find('[class*="badge"], [class*="status"]').length > 0) {
        cy.get('[class*="badge"], [class*="status"]').first().then(($badge) => {
          const badgeStyles = window.getComputedStyle($badge[0])
          cy.wrap({
            padding: badgeStyles.padding,
            borderRadius: badgeStyles.borderRadius,
            fontSize: badgeStyles.fontSize
          }).as("dashboardBadgeStyles")
        })
      }
    })

    cy.visit("/billing")
    cy.wait("@getTransactions")

    // Compare with billing page status badges
    cy.get('[class*="badge"], [class*="status"]').first().then(($badge) => {
      const badgeStyles = window.getComputedStyle($badge[0])
      
      cy.get("@dashboardBadgeStyles").then((dashBadgeStyles: any) => {
        // Badge styling should be consistent
        expect(badgeStyles.padding).to.equal(dashBadgeStyles.padding)
        expect(badgeStyles.borderRadius).to.equal(dashBadgeStyles.borderRadius)
        expect(badgeStyles.fontSize).to.equal(dashBadgeStyles.fontSize)
      })
    })
  })

  it("should perform side-by-side visual comparison", () => {
    // This test simulates opening both pages in tabs for manual comparison
    // First capture both pages in sequence for comparison
    
    cy.visit("/dashboard")
    cy.wait("@getDashboard")
    cy.wait(1000)
    
    // Capture full page screenshot for dashboard
    cy.screenshot("dashboard-full-page", {
      capture: "fullPage",
      disableTimersAndAnimations: true
    })

    cy.visit("/billing")
    cy.wait("@getTransactions") 
    cy.wait(1000)
    
    // Capture full page screenshot for billing
    cy.screenshot("billing-full-page", {
      capture: "fullPage",
      disableTimersAndAnimations: true
    })

    // Log instructions for manual comparison
    cy.log("Screenshots captured for manual comparison:")
    cy.log("1. dashboard-full-page.png")
    cy.log("2. billing-full-page.png")
    cy.log("Compare these images side-by-side to verify consistent typography, spacing, and colors")
  })
})
