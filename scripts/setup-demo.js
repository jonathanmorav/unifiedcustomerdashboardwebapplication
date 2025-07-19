#!/usr/bin/env node

/**
 * Demo Environment Setup Script
 * Creates a .env.local file with demo mode enabled
 */

const fs = require('fs');
const path = require('path');

const demoEnvContent = `# Unified Customer Dashboard - Demo Environment
# This file enables demo mode with mock data for testing

# =============================================================================
# DATABASE CONFIGURATION
# =============================================================================
# For demo, you can use a local PostgreSQL or the Docker setup
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/unified_customer_dashboard"

# =============================================================================
# NEXTAUTH CONFIGURATION
# =============================================================================
NEXTAUTH_URL="http://localhost:3000"
# Generate a secure secret: openssl rand -base64 32
NEXTAUTH_SECRET="demo-secret-key-for-development-only-minimum-32-chars"

# =============================================================================
# GOOGLE OAUTH CONFIGURATION (Demo Mode)
# =============================================================================
# These are placeholder values for demo mode
# In production, you'd get these from Google Cloud Console
GOOGLE_CLIENT_ID="demo-client-id.apps.googleusercontent.com"
GOOGLE_CLIENT_SECRET="demo-client-secret"

# =============================================================================
# DEMO MODE CONFIGURATION
# =============================================================================
# Enable demo mode to use mock data instead of real API calls
DEMO_MODE="true"
NEXT_PUBLIC_DEMO_MODE="true"

# =============================================================================
# HUBSPOT API CONFIGURATION (Demo Mode)
# =============================================================================
# Placeholder values for demo mode
HUBSPOT_API_KEY="demo-hubspot-api-key"
HUBSPOT_BASE_URL="https://api.hubapi.com"

# =============================================================================
# DWOLLA API CONFIGURATION (Demo Mode)
# =============================================================================
# Placeholder values for demo mode
DWOLLA_CLIENT_ID="demo-dwolla-client-id"
DWOLLA_CLIENT_SECRET="demo-dwolla-client-secret"
DWOLLA_ENVIRONMENT="sandbox"
DWOLLA_BASE_URL="https://api-sandbox.dwolla.com"

# =============================================================================
# AUTHORIZED USERS
# =============================================================================
# Add your email here to access the application
AUTHORIZED_EMAILS="demo@example.com,admin@example.com"

# =============================================================================
# SESSION CONFIGURATION
# =============================================================================
SESSION_TIMEOUT_MINUTES="30"

# =============================================================================
# APPLICATION CONFIGURATION
# =============================================================================
APP_URL="http://localhost:3000"
NODE_ENV="development"

# =============================================================================
# LOGGING CONFIGURATION
# =============================================================================
LOG_LEVEL="debug"

# =============================================================================
# RATE LIMITING
# =============================================================================
RATE_LIMIT_REQUESTS_PER_MINUTE="60"

# =============================================================================
# SECURITY CONFIGURATION
# =============================================================================
ENABLE_SECURITY_HEADERS="true"

# =============================================================================
# PDF EXPORT CONFIGURATION
# =============================================================================
PDF_COMPANY_NAME="Demo Company"
PDF_COMPANY_LOGO_URL="https://via.placeholder.com/200x80/0066CC/FFFFFF?text=Demo+Company"

# =============================================================================
# API SECURITY
# =============================================================================
AUTHORIZED_API_KEYS=""
`;

const envPath = path.join(__dirname, '..', '.env.local');

try {
  fs.writeFileSync(envPath, demoEnvContent);
  console.log('✅ Demo environment file created successfully!');
  console.log('📁 File location:', envPath);
  console.log('');
  console.log('🎯 Demo Mode Features:');
  console.log('   • Mock data for HubSpot and Dwolla');
  console.log('   • Sample customer data (Acme Corporation, Tech Innovations Inc)');
  console.log('   • Search functionality with realistic results');
  console.log('   • No real API calls required');
  console.log('');
  console.log('🔍 Sample Search Terms to Try:');
  console.log('   • "acme" - Shows Acme Corporation data');
  console.log('   • "john.doe@acme.com" - Email search');
  console.log('   • "cust_12345" - Customer ID search');
  console.log('   • "tech innovations" - Company name search');
  console.log('   • "invoice" - Invoice-related data');
  console.log('');
  console.log('🚀 Next Steps:');
  console.log('   1. Start the database: docker-compose up postgres');
  console.log('   2. Run migrations: npm run setup:db');
  console.log('   3. Start the app: npm run dev');
  console.log('   4. Visit: http://localhost:3000/dashboard');
  console.log('');
  console.log('⚠️  Remember: This is demo mode with mock data only!');
} catch (error) {
  console.error('❌ Error creating demo environment file:', error.message);
  process.exit(1);
} 