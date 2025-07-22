#!/usr/bin/env node

/**
 * Production API Setup Script
 * This script helps set up API keys and verifies field mappings for production deployment
 */

const fs = require('fs');
const path = require('path');
const readline = require('readline');

const envPath = path.join(__dirname, '..', '.env.local');

// Define field mappings between API responses and UI components
const FIELD_MAPPINGS = {
  hubspot: {
    company: {
      'properties.name': 'hubspot.company.name',
      'properties.hs_object_id': 'hubspot.company.id', 
      'properties.owner_email': 'hubspot.company.ownerEmail',
      'properties.dwolla_customer_id': 'hubspot.company.dwollaCustomerId'
    },
    summaryOfBenefits: {
      'properties.amount_to_draft': 'hubspot.summaryOfBenefits.amountToDraft',
      'properties.fee_amount': 'hubspot.summaryOfBenefits.feeAmount',
      'properties.pdf_document_url': 'hubspot.summaryOfBenefits.pdfUrl',
      'properties.monthly_invoice': 'hubspot.summaryOfBenefits.monthlyInvoice'
    },
    policies: {
      'properties.policy_number': 'policy.id',
      'properties.policy_holder_name': 'policy.name',
      'properties.premium_amount': 'policy.amount',
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
      'type': 'dwolla.fundingSource.accountType',
      'accountNumber (masked)': 'dwolla.fundingSource.accountNumber',
      'routingNumber': 'dwolla.fundingSource.routingNumber',
      'status': 'dwolla.fundingSource.verificationStatus'
    },
    transfers: {
      'amount.value + currency': 'transfer.amount',
      'created': 'transfer.date',
      'status': 'transfer.status',
      'metadata.type': 'transfer.type'
    }
  }
};

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function question(prompt) {
  return new Promise((resolve) => {
    rl.question(prompt, resolve);
  });
}

async function setupAPIs() {
  console.log('🚀 Production API Setup for Unified Customer Dashboard\n');
  
  // Read current env file
  let envContent = '';
  try {
    envContent = fs.readFileSync(envPath, 'utf8');
  } catch (error) {
    console.error('❌ Could not read .env.local file. Make sure it exists.');
    process.exit(1);
  }

  console.log('📋 This script will help you configure API keys for production deployment.\n');
  
  const proceed = await question('Do you want to proceed? (y/N): ');
  if (proceed.toLowerCase() !== 'y') {
    console.log('Setup cancelled.');
    rl.close();
    return;
  }

  console.log('\n🔐 Setting up API credentials...\n');

  // Google OAuth Setup
  console.log('1. GOOGLE OAUTH SETUP');
  console.log('   Go to: https://console.cloud.google.com/apis/credentials');
  console.log('   Create OAuth 2.0 Client ID');
  console.log('   Add redirect URIs:');
  console.log('   - http://localhost:3000/api/auth/callback/google');
  console.log('   - https://yourdomain.com/api/auth/callback/google\n');
  
  const googleClientId = await question('Enter Google Client ID: ');
  const googleClientSecret = await question('Enter Google Client Secret: ');

  // HubSpot API Setup
  console.log('\n2. HUBSPOT API SETUP');
  console.log('   Go to: HubSpot Developer Portal');
  console.log('   Create a Private App');
  console.log('   Required scopes:');
  console.log('   - crm.objects.companies.read');
  console.log('   - crm.objects.custom.read');
  console.log('   - crm.schemas.custom.read\n');
  
  const hubspotApiKey = await question('Enter HubSpot API Key: ');

  // Dwolla API Setup
  console.log('\n3. DWOLLA API SETUP');
  console.log('   Sandbox: https://accounts-sandbox.dwolla.com');
  console.log('   Production: https://accounts.dwolla.com');
  console.log('   Create an application\n');
  
  const dwollaKey = await question('Enter Dwolla Key: ');
  const dwollaSecret = await question('Enter Dwolla Secret: ');
  const dwollaEnvironment = await question('Environment (sandbox/production) [sandbox]: ') || 'sandbox';

  // Update environment file
  let updatedEnvContent = envContent;
  
  if (googleClientId) {
    updatedEnvContent = updatedEnvContent.replace(
      'GOOGLE_CLIENT_ID="[REPLACE_WITH_YOUR_GOOGLE_CLIENT_ID]"',
      `GOOGLE_CLIENT_ID="${googleClientId}"`
    );
  }
  
  if (googleClientSecret) {
    updatedEnvContent = updatedEnvContent.replace(
      'GOOGLE_CLIENT_SECRET="[REPLACE_WITH_YOUR_GOOGLE_CLIENT_SECRET]"',
      `GOOGLE_CLIENT_SECRET="${googleClientSecret}"`
    );
  }
  
  if (hubspotApiKey) {
    updatedEnvContent = updatedEnvContent.replace(
      'HUBSPOT_API_KEY="[REPLACE_WITH_YOUR_HUBSPOT_API_KEY]"',
      `HUBSPOT_API_KEY="${hubspotApiKey}"`
    );
  }
  
  if (dwollaKey) {
    updatedEnvContent = updatedEnvContent.replace(
      'DWOLLA_KEY="[REPLACE_WITH_YOUR_DWOLLA_KEY]"',
      `DWOLLA_KEY="${dwollaKey}"`
    );
  }
  
  if (dwollaSecret) {
    updatedEnvContent = updatedEnvContent.replace(
      'DWOLLA_SECRET="[REPLACE_WITH_YOUR_DWOLLA_SECRET]"',
      `DWOLLA_SECRET="${dwollaSecret}"`
    );
  }
  
  if (dwollaEnvironment === 'production') {
    updatedEnvContent = updatedEnvContent.replace(
      'DWOLLA_ENVIRONMENT="sandbox"',
      'DWOLLA_ENVIRONMENT="production"'
    );
    updatedEnvContent = updatedEnvContent.replace(
      'DWOLLA_BASE_URL="https://api-sandbox.dwolla.com"',
      'DWOLLA_BASE_URL="https://api.dwolla.com"'
    );
  }

  // Write updated env file
  try {
    fs.writeFileSync(envPath, updatedEnvContent);
    console.log('\n✅ Environment file updated successfully!');
  } catch (error) {
    console.error('❌ Error writing environment file:', error.message);
    rl.close();
    return;
  }

  console.log('\n📋 FIELD MAPPING VERIFICATION\n');
  console.log('The following shows how API data maps to your new UI components:\n');
  
  console.log('🏢 HUBSPOT DATA MAPPING:');
  console.log('Company Information (data-panels.tsx lines 74-88):');
  Object.entries(FIELD_MAPPINGS.hubspot.company).forEach(([apiField, uiField]) => {
    console.log(`   ${apiField} → ${uiField}`);
  });
  
  console.log('\nSummary of Benefits (data-panels.tsx lines 112-126):');
  Object.entries(FIELD_MAPPINGS.hubspot.summaryOfBenefits).forEach(([apiField, uiField]) => {
    console.log(`   ${apiField} → ${uiField}`);
  });
  
  console.log('\n💳 DWOLLA DATA MAPPING:');
  console.log('Customer Information (data-panels.tsx lines 179-197):');
  Object.entries(FIELD_MAPPINGS.dwolla.customer).forEach(([apiField, uiField]) => {
    console.log(`   ${apiField} → ${uiField}`);
  });
  
  console.log('Funding Sources (data-panels.tsx lines 210-228):');
  Object.entries(FIELD_MAPPINGS.dwolla.fundingSource).forEach(([apiField, uiField]) => {
    console.log(`   ${apiField} → ${uiField}`);
  });

  console.log('\n⚠️  IMPORTANT FIELD MAPPING ISSUES TO CHECK:\n');
  
  console.log('1. HubSpot Custom Object Names:');
  console.log('   - Verify "summary_of_benefits" object exists in your HubSpot');
  console.log('   - Check custom property names match your setup');
  console.log('   - Update lib/types/hubspot.ts if property names differ\n');
  
  console.log('2. Dwolla Customer Name Concatenation:');
  console.log('   - UI expects: dwolla.customer.name');  
  console.log('   - API provides: firstName + lastName');
  console.log('   - Check lib/api/dwolla/service.ts combines these correctly\n');
  
  console.log('3. Transfer Amount Formatting:');
  console.log('   - UI expects: transfer.amount (formatted string)');
  console.log('   - API provides: { value: "100.00", currency: "USD" }');
  console.log('   - Verify utils/format-currency.ts handles this\n');

  console.log('📝 NEXT STEPS:\n');
  console.log('1. ✅ API keys are configured');
  console.log('2. 🧪 Test API connections:');
  console.log('   npm run dev');
  console.log('   Try searching with real data');
  console.log('3. 🔍 Verify field mappings work correctly');
  console.log('4. 🐛 Check browser console for any mapping errors');
  console.log('5. 📊 Update UI components if field names don\'t match\n');
  
  console.log('🔧 If you need to update field mappings:');
  console.log('   - Edit components/v0/data-panels.tsx');
  console.log('   - Update lib/api/*/service.ts files');
  console.log('   - Modify lib/types/* for TypeScript types\n');

  const testNow = await question('Would you like to start the development server to test? (y/N): ');
  if (testNow.toLowerCase() === 'y') {
    console.log('\n🚀 Starting development server...');
    console.log('Run: npm run dev');
  }

  rl.close();
}

// Run the setup
setupAPIs().catch(console.error);
