#!/usr/bin/env node

const https = require('https');
const fs = require('fs');
const path = require('path');

const envPath = path.join(__dirname, '..', '.env.local');
const envContent = fs.readFileSync(envPath, 'utf8');

function getEnvVar(name) {
  const match = envContent.match(new RegExp(`^${name}="?([^"\\n]+)"?$`, 'm'));
  return match ? match[1] : null;
}

const HUBSPOT_API_KEY = getEnvVar('HUBSPOT_API_KEY');

async function makeRequest(options, data = null) {
  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      let responseData = '';
      res.on('data', (chunk) => { responseData += chunk; });
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(responseData) });
        } catch (error) {
          resolve({ status: res.statusCode, data: responseData });
        }
      });
    });
    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

async function getPoliciesObjectInfo() {
  console.log('🔍 Getting Policies object information...\n');
  
  // First get all custom objects
  const options = {
    hostname: 'api.hubapi.com',
    path: '/crm/v3/schemas',
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${HUBSPOT_API_KEY}`,
      'Content-Type': 'application/json'
    }
  };

  try {
    const response = await makeRequest(options);
    
    if (response.status === 200) {
      console.log('📋 All custom objects found:');
      
      // Filter out standard objects
      const customObjects = response.data.results.filter(schema => 
        !['companies', 'contacts', 'deals', 'tickets', 'products', 'line_items', 'quotes'].includes(schema.name)
      );
      
      customObjects.forEach(schema => {
        console.log(`\n   Name: ${schema.name}`);
        console.log(`   Object Type ID: ${schema.objectTypeId}`);
        console.log(`   ID: ${schema.id}`);
        console.log(`   Labels: ${schema.labels?.singular} / ${schema.labels?.plural}`);
      });
      
      // Look specifically for policies
      const policiesObject = response.data.results.find(schema => 
        schema.name === 'policies' || 
        schema.name === 'policy' ||
        schema.labels?.singular?.toLowerCase().includes('policy') ||
        schema.labels?.plural?.toLowerCase().includes('policies')
      );
      
      if (policiesObject) {
        console.log('\n✅ Found Policies object:');
        console.log(`   Name: ${policiesObject.name}`);
        console.log(`   Object Type ID: ${policiesObject.objectTypeId}`);
        console.log(`   ID: ${policiesObject.id}`);
        console.log(`   Labels: ${policiesObject.labels?.singular} / ${policiesObject.labels?.plural}`);
        
        // Test if we can access it
        await testPoliciesAccess(policiesObject.objectTypeId);
      } else {
        console.log('\n⚠️  No policies object found. Available custom objects listed above.');
      }
      
    } else {
      console.error(`❌ Failed to get schemas (${response.status})`);
      console.error('Response:', response.data);
    }
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

async function testPoliciesAccess(objectTypeId) {
  console.log(`\n🧪 Testing access to policies with object type: ${objectTypeId}`);
  
  const options = {
    hostname: 'api.hubapi.com',
    path: `/crm/v3/objects/${objectTypeId}?limit=1`,
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${HUBSPOT_API_KEY}`,
      'Content-Type': 'application/json'
    }
  };

  try {
    const response = await makeRequest(options);
    console.log(`   Status: ${response.status}`);
    
    if (response.status === 200) {
      console.log(`   ✅ SUCCESS! Can access policies object`);
      console.log(`   Found ${response.data.results?.length || 0} policies (limited to 1)`);
    } else {
      console.log('   Response:', response.data);
    }
  } catch (error) {
    console.log(`   Error: ${error.message}`);
  }
}

async function main() {
  console.log('🧪 HubSpot Policies Object Type Finder\n');

  if (!HUBSPOT_API_KEY) {
    console.error('❌ Missing HubSpot API key!');
    process.exit(1);
  }

  console.log(`🔑 Using API Key: ${HUBSPOT_API_KEY.substring(0, 15)}...\n`);

  try {
    await getPoliciesObjectInfo();
  } catch (error) {
    console.error('\n💥 Script failed:', error.message);
    process.exit(1);
  }
}

main();