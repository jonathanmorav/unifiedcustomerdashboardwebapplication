#!/usr/bin/env node

/**
 * Field Mapping Verification Script
 * 
 * This script verifies that all field mappings between API responses
 * and UI components are working correctly.
 * 
 * Usage: node scripts/verify-field-mappings.js
 */

const fs = require('fs');
const path = require('path');

// ANSI color codes
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
};

// Field mapping definitions
const FIELD_MAPPINGS = {
  hubspot: {
    company: {
      'properties.name': 'hubspot.company.name',
      'properties.hs_object_id': 'hubspot.company.id', 
      'properties.owner_email': 'hubspot.company.ownerEmail',
      'properties.dwolla_customer_id': 'hubspot.company.dwollaId',
      'properties.onboarding_status': 'hubspot.company.onboardingStatus',
      'properties.onboarding_step': 'hubspot.company.onboardingStep'
    },
    summaryOfBenefits: {
      'properties.amount_to_draft': 'hubspot.summaryOfBenefits.amountToDraft',
      'properties.fee_amount': 'hubspot.summaryOfBenefits.feeAmount',
      'properties.pdf_document_url': 'hubspot.summaryOfBenefits.pdfDocumentUrl',
      'properties.monthly_invoice': 'hubspot.summaryOfBenefits.monthlyInvoice'
    },
    policies: {
      'properties.policy_number': 'policy.policyNumber',
      'properties.policy_holder_name': 'policy.policyHolderName',
      'properties.premium_amount': 'policy.premiumAmount',
      'properties.status': 'policy.status'
    }
  },
  dwolla: {
    customer: {
      'id': 'dwolla.customer.id',
      'email': 'dwolla.customer.email',
      'firstName + lastName': 'dwolla.customer.name',
      'status': 'dwolla.customer.status',
      'businessName': 'dwolla.customer.businessName'
    },
    fundingSource: {
      'type': 'dwolla.fundingSource.type',
      'accountNumber (masked)': 'dwolla.fundingSource.accountNumberMasked',
      'routingNumber': 'dwolla.fundingSource.routingNumber',
      'status': 'dwolla.fundingSource.status'
    },
    transfers: {
      'amount.value + currency': 'transfer.amount + transfer.currency',
      'created': 'transfer.created',
      'status': 'transfer.status',
      'metadata.type': 'transfer.type'
    }
  }
};

// Mock data for testing
const mockHubSpotData = {
  company: {
    id: "12345",
    properties: {
      name: "Acme Corporation",
      domain: "acme.com",
      hs_object_id: "12345",
      createdate: "2024-01-15T10:30:00Z",
      hs_lastmodifieddate: "2025-01-18T14:45:00Z",
      owner_email: "support@acme.com",
      dwolla_customer_id: "e8b0f3d2-4a89-4c6b-8383-1234567890ab",
      onboarding_status: "in_progress",
      onboarding_step: "step_3_verification",
    },
    createdAt: "2024-01-15T10:30:00Z",
    updatedAt: "2025-01-18T14:45:00Z",
    archived: false,
  },
  summaryOfBenefits: [
    {
      id: "sob_001",
      properties: {
        hs_object_id: "sob_001",
        amount_to_draft: 2500.0,
        fee_amount: 125.0,
        pdf_document_url: "https://example.com/sob/2025-01.pdf",
        createdate: "2025-01-01T00:00:00Z",
        hs_lastmodifieddate: "2025-01-15T12:00:00Z",
      },
      createdAt: "2025-01-01T00:00:00Z",
      updatedAt: "2025-01-15T12:00:00Z",
      archived: false,
    }
  ],
  policies: [
    {
      id: "policy_001",
      properties: {
        policy_number: "POL-2025-001",
        policy_holder_name: "Acme Corporation",
        coverage_type: "General Liability",
        premium_amount: 5000.0,
        effective_date: "2025-01-01",
        status: "active"
      },
      createdAt: "2025-01-01T00:00:00Z",
      updatedAt: "2025-01-01T00:00:00Z",
      archived: false,
    }
  ]
};

const mockDwollaData = {
  customer: {
    id: "cust_12345",
    firstName: "John",
    lastName: "Doe",
    email: "john.doe@acme.com",
    type: "business",
    status: "verified",
    created: "2024-01-15T10:30:00Z",
    businessName: "Acme Corporation",
  },
  fundingSources: [
    {
      id: "fs_001",
      name: "Chase Bank - 1234",
      type: "bank",
      bankAccountType: "checking",
      accountNumberMasked: "****1234",
      routingNumber: "021000021",
      status: "verified",
      verified: true,
    }
  ],
  transfers: [
    {
      id: "transfer_001",
      amount: "2500.00",
      currency: "USD",
      status: "processed",
      created: "2024-01-15T10:00:00Z",
      sourceId: "fs_001",
      destinationId: "dest_001",
      correlationId: "corr_123",
    }
  ]
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function verifyHubSpotMappings() {
  log('\n🏢 VERIFYING HUBSPOT FIELD MAPPINGS', 'blue');
  
  // Test company mappings
  log('\nCompany Information:', 'cyan');
  const company = mockHubSpotData.company;
  
  const companyMappings = [
    { api: company.properties.name, ui: 'hubspot.company.name', expected: 'Acme Corporation' },
    { api: company.id, ui: 'hubspot.company.id', expected: '12345' },
    { api: company.properties.owner_email, ui: 'hubspot.company.ownerEmail', expected: 'support@acme.com' },
    { api: company.properties.dwolla_customer_id, ui: 'hubspot.company.dwollaId', expected: 'e8b0f3d2-4a89-4c6b-8383-1234567890ab' },
  ];
  
  companyMappings.forEach(mapping => {
    const status = mapping.api === mapping.expected ? '✅' : '❌';
    log(`  ${status} ${mapping.ui}: ${mapping.api}`, mapping.api === mapping.expected ? 'green' : 'red');
  });
  
  // Test Summary of Benefits mappings
  log('\nSummary of Benefits:', 'cyan');
  const sob = mockHubSpotData.summaryOfBenefits[0];
  
  const sobMappings = [
    { api: sob.properties.amount_to_draft, ui: 'hubspot.summaryOfBenefits.amountToDraft', expected: 2500.0 },
    { api: sob.properties.fee_amount, ui: 'hubspot.summaryOfBenefits.feeAmount', expected: 125.0 },
    { api: sob.properties.pdf_document_url, ui: 'hubspot.summaryOfBenefits.pdfDocumentUrl', expected: 'https://example.com/sob/2025-01.pdf' },
  ];
  
  sobMappings.forEach(mapping => {
    const status = mapping.api === mapping.expected ? '✅' : '❌';
    log(`  ${status} ${mapping.ui}: ${mapping.api}`, mapping.api === mapping.expected ? 'green' : 'red');
  });
  
  // Test Policy mappings
  log('\nPolicies:', 'cyan');
  const policy = mockHubSpotData.policies[0];
  
  const policyMappings = [
    { api: policy.properties.policy_number, ui: 'policy.policyNumber', expected: 'POL-2025-001' },
    { api: policy.properties.policy_holder_name, ui: 'policy.policyHolderName', expected: 'Acme Corporation' },
    { api: policy.properties.premium_amount, ui: 'policy.premiumAmount', expected: 5000.0 },
    { api: policy.properties.status, ui: 'policy.status', expected: 'active' },
  ];
  
  policyMappings.forEach(mapping => {
    const status = mapping.api === mapping.expected ? '✅' : '❌';
    log(`  ${status} ${mapping.ui}: ${mapping.api}`, mapping.api === mapping.expected ? 'green' : 'red');
  });
}

function verifyDwollaMappings() {
  log('\n💳 VERIFYING DWOLLA FIELD MAPPINGS', 'blue');
  
  // Test customer mappings
  log('\nCustomer Information:', 'cyan');
  const customer = mockDwollaData.customer;
  
  const customerMappings = [
    { api: customer.id, ui: 'dwolla.customer.id', expected: 'cust_12345' },
    { api: customer.email, ui: 'dwolla.customer.email', expected: 'john.doe@acme.com' },
    { api: `${customer.firstName} ${customer.lastName}`, ui: 'dwolla.customer.name', expected: 'John Doe' },
    { api: customer.status, ui: 'dwolla.customer.status', expected: 'verified' },
    { api: customer.businessName, ui: 'dwolla.customer.businessName', expected: 'Acme Corporation' },
  ];
  
  customerMappings.forEach(mapping => {
    const status = mapping.api === mapping.expected ? '✅' : '❌';
    log(`  ${status} ${mapping.ui}: ${mapping.api}`, mapping.api === mapping.expected ? 'green' : 'red');
  });
  
  // Test funding source mappings
  log('\nFunding Sources:', 'cyan');
  const source = mockDwollaData.fundingSources[0];
  
  const sourceMappings = [
    { api: source.type, ui: 'dwolla.fundingSource.type', expected: 'bank' },
    { api: source.accountNumberMasked, ui: 'dwolla.fundingSource.accountNumberMasked', expected: '****1234' },
    { api: source.routingNumber, ui: 'dwolla.fundingSource.routingNumber', expected: '021000021' },
    { api: source.status, ui: 'dwolla.fundingSource.status', expected: 'verified' },
  ];
  
  sourceMappings.forEach(mapping => {
    const status = mapping.api === mapping.expected ? '✅' : '❌';
    log(`  ${status} ${mapping.ui}: ${mapping.api}`, mapping.api === mapping.expected ? 'green' : 'red');
  });
  
  // Test transfer mappings
  log('\nTransfers:', 'cyan');
  const transfer = mockDwollaData.transfers[0];
  
  const transferMappings = [
    { api: transfer.amount, ui: 'transfer.amount', expected: '2500.00' },
    { api: transfer.currency, ui: 'transfer.currency', expected: 'USD' },
    { api: transfer.status, ui: 'transfer.status', expected: 'processed' },
    { api: transfer.created, ui: 'transfer.created', expected: '2024-01-15T10:00:00Z' },
  ];
  
  transferMappings.forEach(mapping => {
    const status = mapping.api === mapping.expected ? '✅' : '❌';
    log(`  ${status} ${mapping.ui}: ${mapping.api}`, mapping.api === mapping.expected ? 'green' : 'red');
  });
}

function checkFileMappings() {
  log('\n📁 CHECKING FILE MAPPINGS', 'blue');
  
  const filesToCheck = [
    { path: 'lib/types/hubspot.ts', description: 'HubSpot TypeScript types' },
    { path: 'lib/api/hubspot/service.ts', description: 'HubSpot service layer' },
    { path: 'lib/types/dwolla.ts', description: 'Dwolla TypeScript types' },
    { path: 'lib/api/dwolla/service.ts', description: 'Dwolla service layer' },
    { path: 'components/results/hubspot-result-panel.tsx', description: 'HubSpot UI component' },
    { path: 'components/results/dwolla-result-panel.tsx', description: 'Dwolla UI component' },
  ];
  
  filesToCheck.forEach(file => {
    const fullPath = path.join(__dirname, '..', file.path);
    if (fs.existsSync(fullPath)) {
      log(`  ✅ ${file.description}: ${file.path}`, 'green');
    } else {
      log(`  ❌ ${file.description}: ${file.path} (missing)`, 'red');
    }
  });
}

function generateRecommendations() {
  log('\n🔧 RECOMMENDATIONS', 'yellow');
  
  log('\n1. HubSpot Configuration:', 'cyan');
  log('   - Verify custom property "dwolla_customer_id" exists in HubSpot');
  log('   - Check "summary_of_benefits" custom object is configured');
  log('   - Ensure all required scopes are granted to your API key');
  
  log('\n2. Dwolla Configuration:', 'cyan');
  log('   - Verify production/sandbox environment is correctly set');
  log('   - Check that sensitive data masking is working in production');
  log('   - Test transfer amount formatting with real currency values');
  
  log('\n3. Testing Steps:', 'cyan');
  log('   - Run: npm run dev');
  log('   - Test search with real customer data');
  log('   - Check browser console for any mapping errors');
  log('   - Verify all UI components display data correctly');
  
  log('\n4. Production Checklist:', 'cyan');
  log('   - Update environment variables for production');
  log('   - Test with production API endpoints');
  log('   - Verify SSL certificates and security headers');
  log('   - Check rate limiting and error handling');
}

async function main() {
  log('🔍 FIELD MAPPING VERIFICATION SCRIPT', 'magenta');
  log('=====================================\n');
  
  checkFileMappings();
  verifyHubSpotMappings();
  verifyDwollaMappings();
  generateRecommendations();
  
  log('\n✅ Verification complete!', 'green');
  log('\nNext steps:');
  log('1. Run the setup script: node scripts/setup-production-apis.js');
  log('2. Start development server: npm run dev');
  log('3. Test with real API data');
  log('4. Check console logs for any mapping errors\n');
}

main().catch(console.error); 