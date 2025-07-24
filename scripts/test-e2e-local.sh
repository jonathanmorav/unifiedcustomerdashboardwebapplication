#!/bin/bash

# Local E2E Test Verification Script
# This script helps verify the E2E test setup works correctly

echo "🚀 Starting E2E Test Verification"
echo "=================================="

# Check if Cypress is installed
if ! command -v npx &> /dev/null; then
    echo "❌ npm/npx not found. Please install Node.js and npm first."
    exit 1
fi

# Check if dependencies are installed
if [ ! -d "node_modules" ] || [ ! -d "node_modules/cypress" ]; then
    echo "📦 Installing dependencies..."
    npm install
fi

# Check if application is running
echo "🔍 Checking if application is running on http://localhost:3000..."
if curl -f -s http://localhost:3000 > /dev/null; then
    echo "✅ Application is running"
    APP_RUNNING=true
else
    echo "⚠️  Application is not running. You'll need to start it first:"
    echo "   Run: npm run dev"
    echo ""
    echo "🔧 For testing purposes, we'll verify the test structure only..."
    APP_RUNNING=false
fi

# Verify test files exist
echo ""
echo "📁 Verifying test file structure..."
TEST_FILES=(
    "cypress/e2e/regression-suite.cy.ts"
    "cypress/e2e/week-preset-date-range.cy.ts"
    "cypress/e2e/custom-date-range.cy.ts"
    "cypress/e2e/status-badge.cy.ts"
    "cypress/e2e/pagination.cy.ts"
)

for file in "${TEST_FILES[@]}"; do
    if [ -f "$file" ]; then
        echo "  ✅ $file"
    else
        echo "  ❌ $file (missing)"
    fi
done

# Verify configuration files
echo ""
echo "⚙️  Verifying configuration files..."
CONFIG_FILES=(
    "cypress.config.ts"
    "cypress/support/e2e.ts"
    "cypress/support/commands.ts"
)

for file in "${CONFIG_FILES[@]}"; do
    if [ -f "$file" ]; then
        echo "  ✅ $file"
    else
        echo "  ❌ $file (missing)"
    fi
done

# Check package.json scripts
echo ""
echo "📝 Verifying package.json scripts..."
SCRIPTS=(
    "test:e2e"
    "test:e2e:open"
    "test:e2e:headless"
    "test:regression"
)

for script in "${SCRIPTS[@]}"; do
    if npm run | grep -q "$script"; then
        echo "  ✅ $script"
    else
        echo "  ❌ $script (missing)"
    fi
done

echo ""
echo "🧪 Test Commands Available:"
echo "=========================="
echo "npm run test:e2e:open      # Open Cypress Test Runner (interactive)"
echo "npm run test:e2e           # Run all E2E tests (headless)"
echo "npm run test:regression    # Run regression test suite"
echo ""

if [ "$APP_RUNNING" = true ]; then
    echo "🎯 You can now run the tests!"
    echo ""
    echo "To run a quick verification test:"
    echo "npx cypress run --spec 'cypress/e2e/regression-suite.cy.ts'"
else
    echo "⚡ To run tests:"
    echo "1. Start the application: npm run dev"
    echo "2. Run tests: npm run test:e2e"
fi

echo ""
echo "📚 For more information, see: cypress/README.md"
echo "✨ E2E Test setup verification complete!"
