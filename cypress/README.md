# End-to-End Regression Test Suite

This directory contains comprehensive end-to-end regression tests for the Unified Customer Dashboard, covering critical user workflows and functionality.

## Test Coverage

The regression test suite covers the following key scenarios:

### 1. Week Preset Date Range Tests (`week-preset-date-range.cy.ts`)

- ✅ Week preset returns correct first/last day (Sunday to Saturday)
- ✅ Verifies ISO string format for backend API calls
- ✅ Validates week boundaries and current week calculation
- ✅ Tests pagination reset when date preset changes

### 2. Custom Date Range Tests (`custom-date-range.cy.ts`)

- ✅ Custom range filter hits back-end with correct ISO strings
- ✅ Validates ISO string format and timezone handling
- ✅ Tests date picker functionality and user interactions
- ✅ Verifies pagination reset and state management

### 3. Status Badge Tests (`status-badge.cy.ts`)

- ✅ Status badge shows "Processed" correctly
- ✅ Tests all status types (processed, processing, pending, failed, cancelled, returned)
- ✅ Validates color coding and visual indicators
- ✅ Tests status filtering functionality

### 4. Pagination Tests (`pagination.cy.ts`)

- ✅ Pagination shows correct number of pages
- ✅ Navigation works properly (first, previous, next, last)
- ✅ Page numbers and ellipsis display correctly
- ✅ Handles empty states and large datasets
- ✅ Maintains state during browser navigation

### 5. Integration Test Suite (`regression-suite.cy.ts`)

- ✅ Full integration workflow testing all components together
- ✅ Cross-component interaction validation
- ✅ End-to-end user journey testing

## Running Tests

### Prerequisites

1. Ensure the application is running:

   ```bash
   npm run dev
   ```

2. Install Cypress dependencies:
   ```bash
   npm install
   ```

### Local Development

#### Open Cypress Test Runner (Interactive)

```bash
npm run test:e2e:open
```

#### Run All E2E Tests (Headless)

```bash
npm run test:e2e
```

#### Run Specific Regression Suite

```bash
npm run test:regression
```

#### Run Individual Test Files

```bash
# Week preset tests
npx cypress run --spec "cypress/e2e/week-preset-date-range.cy.ts"

# Custom date range tests
npx cypress run --spec "cypress/e2e/custom-date-range.cy.ts"

# Status badge tests
npx cypress run --spec "cypress/e2e/status-badge.cy.ts"

# Pagination tests
npx cypress run --spec "cypress/e2e/pagination.cy.ts"

# Full integration suite
npx cypress run --spec "cypress/e2e/regression-suite.cy.ts"
```

### CI/CD Integration

The test suite runs automatically in CI/CD pipelines:

#### GitHub Actions

- **Pull Requests**: All regression tests run on every PR
- **Main Branch**: Full test suite including performance tests
- **Scheduled**: Daily regression runs at 2 AM UTC
- **Cross-browser**: Tests run on Chrome, Firefox, and Edge
- **Multi-viewport**: Desktop, tablet, and mobile viewports

#### CI Commands

```bash
# For CI environments
npm run test:e2e:ci
```

## Test Structure

### Custom Commands (`cypress/support/commands.ts`)

- `cy.setupBillingPageInterceptors()` - Sets up API mocks
- `cy.selectDatePreset(preset)` - Selects date preset from dropdown
- `cy.selectCustomDateRange(start, end)` - Selects custom date range
- `cy.navigateToPage(page)` - Navigates to specific pagination page
- `cy.checkStatusBadge(status)` - Validates status badge display

### API Mocking

Tests use Cypress interceptors to mock backend API responses:

- Transaction data with various statuses
- Pagination responses for multiple pages
- Date range filtering responses
- Error scenarios and edge cases

### Test Data

Each test file includes realistic test data that covers:

- Multiple transaction statuses
- Various date ranges and edge cases
- Pagination scenarios with different page sizes
- Different user interaction patterns

## Configuration

### Cypress Configuration (`cypress.config.ts`)

```typescript
{
  baseUrl: 'http://localhost:3000',
  viewportWidth: 1280,
  viewportHeight: 720,
  defaultCommandTimeout: 10000,
  video: true,
  screenshotOnRunFailure: true
}
```

### Environment Variables

- `CYPRESS_baseUrl` - Application base URL
- `CI` - Enables CI-specific configurations

## Debugging

### Screenshots and Videos

- Screenshots are automatically captured on test failures
- Videos are recorded for all test runs in CI
- Artifacts are stored for 7 days in CI environments

### Interactive Debugging

```bash
# Open Cypress with dev tools
npm run test:e2e:open
```

### Debug Logs

Enable debug logging in tests:

```typescript
cy.debug() // Pauses test execution
cy.log("Debug message") // Adds custom log messages
```

## Best Practices

### 1. Test Organization

- Each test file focuses on a specific feature area
- Tests are organized by user workflows
- Integration tests verify cross-component functionality

### 2. Selectors

- Use `data-testid` attributes for reliable element selection
- Avoid CSS class or text-based selectors when possible
- Include accessibility attributes (aria-label) in assertions

### 3. API Mocking

- Mock all external API calls for consistent test results
- Use realistic test data that matches production scenarios
- Include error scenarios and edge cases

### 4. Assertions

- Verify both UI state and API calls
- Check accessibility attributes and ARIA labels
- Validate data formats (especially ISO strings for dates)

### 5. Maintainability

- Keep tests focused and atomic
- Use custom commands for common operations
- Document complex test scenarios

## Troubleshooting

### Common Issues

#### Tests fail with "element not found"

- Ensure the application is running on the correct port
- Check that data-testid attributes are present in components
- Verify API mocks are correctly set up

#### Date-related test failures

- Tests may fail if run across day boundaries
- Ensure consistent timezone handling in tests
- Use fixed dates in test data when possible

#### Pagination tests intermittent failures

- Verify API interceptors match the correct URL patterns
- Check that pagination components have proper aria-labels
- Ensure test data includes correct pagination metadata

### Getting Help

For issues with the test suite:

1. Check the test logs and screenshots
2. Run tests locally in interactive mode
3. Verify the application is working correctly in browser
4. Review recent changes to components being tested

## Contributing

When adding new tests:

1. Follow the existing test structure and naming conventions
2. Add appropriate API mocks and test data
3. Include both positive and negative test cases
4. Update this README with new test coverage
5. Ensure tests run reliably in CI environment
