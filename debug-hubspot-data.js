#!/usr/bin/env node

/**
 * Debug script to inspect HubSpot data structure and see what's actually returned
 */

const https = require('https');
const fs = require('fs');
const path = require('path');

// Read .env.local file directly
const envPath = path.join(__dirname, '.env.local');
const envContent = fs.readFileSync(envPath, 'utf8');

// Parse environment variables
function getEnvVar(name) {
  const match = envContent.match(new RegExp(`^${name}="?([^"\\n]+)"?$`, 'm'));
  return match ? match[1] : null;
}

const HUBSPOT_API_KEY = getEnvVar('HUBSPOT_API_KEY');

async function makeRequest(options) {
  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          resolve({ status: res.statusCode, data: parsed });
        } catch (e) {
          resolve({ status: res.statusCode, data });
        }
      });
    });
    
    req.on('error', reject);
    req.end();
  });
}

async function debugHubSpotData() {
  console.log('🔍 Debugging HubSpot Data Structure\n');
  
  try {
    // Search for companies using the same method as the client
    const searchPayload = {
      filterGroups: [{
        filters: [{
          propertyName: "email___owner",
          operator: "EQ",
          value: "rod.wing@fbfs.com"  // Use the same email from the logs
        }]
      }],
      properties: ["name", "domain", "email___owner", "dwolla_customer_id", "onboarding_status", "onboarding_step", "hs_object_id"],
      limit: 10
    };

    const options = {
      hostname: 'api.hubapi.com',
      path: '/crm/v3/objects/companies/search',
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${HUBSPOT_API_KEY}`,
        'Content-Type': 'application/json'
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        console.log('📊 Response Status:', res.statusCode);
        
        try {
          const response = JSON.parse(data);
          
          if (response.results && response.results.length > 0) {
            console.log('✅ Found', response.results.length, 'companies\n');
            
            response.results.forEach((company, index) => {
              console.log(`🏢 Company ${index + 1}:`);
              console.log('   - ID:', company.id);
              console.log('   - Raw properties object:', JSON.stringify(company.properties, null, 4));
              console.log('   - Properties keys:', Object.keys(company.properties || {}));
              console.log('   - onboarding_status value:', company.properties?.onboarding_status);
              console.log('   - onboarding_step value:', company.properties?.onboarding_step);
              console.log('   - onboarding_status type:', typeof company.properties?.onboarding_status);
              console.log('   - onboarding_step type:', typeof company.properties?.onboarding_step);
              console.log('');
            });
            
            // Now let's simulate the HubSpotService formatting
            const company = response.results[0];
            console.log('📋 Simulating HubSpotService.formatCustomerData():');
            console.log('   - data.company?.properties?.onboarding_status:', company.properties?.onboarding_status);
            console.log('   - data.company?.properties?.onboarding_step:', company.properties?.onboarding_step);
            console.log('   - onboardingStatus result:', company.properties?.onboarding_status || null);
            console.log('   - onboardingStep result:', company.properties?.onboarding_step || null);
            console.log('');
            
            const mockFormattedData = {
              company: {
                id: company.id,
                name: company.properties?.name || "",
                ownerEmail: company.properties?.email___owner || null,
                dwollaId: company.properties?.dwolla_customer_id || null,
                onboardingStatus: company.properties?.onboarding_status || null,
                onboardingStep: company.properties?.onboarding_step || null,
              }
            };
            
            console.log('🎯 Final formatted company data:', JSON.stringify(mockFormattedData.company, null, 2));
            
          } else {
            console.log('❌ No companies found');
          }
        } catch (e) {
          console.error('❌ Failed to parse response:', e.message);
          console.log('Raw response:', data);
        }
      });
    });

    req.on('error', (error) => {
      console.error('❌ Request failed:', error.message);
    });

    req.write(JSON.stringify(searchPayload));
    req.end();

  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

debugHubSpotData();
