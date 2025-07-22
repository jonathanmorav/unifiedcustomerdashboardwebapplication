#!/usr/bin/env node

/**
 * Dwolla Authentication Test Script
 * Tests the Dwolla OAuth 2.0 Client Credentials flow with Key/Secret
 */

const https = require('https');
const fs = require('fs');
const path = require('path');

// Read .env.local file directly
const envPath = path.join(__dirname, '..', '.env.local');
const envContent = fs.readFileSync(envPath, 'utf8');

// Parse environment variables
function getEnvVar(name) {
  const match = envContent.match(new RegExp(`^${name}="?([^"\n]+)"?$`, 'm'));
  return match ? match[1] : null;
}

const DWOLLA_KEY = getEnvVar('DWOLLA_KEY');
const DWOLLA_SECRET = getEnvVar('DWOLLA_SECRET');
const DWOLLA_ENVIRONMENT = getEnvVar('DWOLLA_ENVIRONMENT') || 'sandbox';

async function testDwollaAuth() {
  console.log('🧪 Testing Dwolla OAuth 2.0 Authentication\n');

  // Check if credentials are provided
  if (!DWOLLA_KEY || !DWOLLA_SECRET) {
    console.error('❌ Missing Dwolla credentials!');
    console.error('Make sure DWOLLA_KEY and DWOLLA_SECRET are set in .env.local');
    process.exit(1);
  }

  if (DWOLLA_KEY.includes('[REPLACE') || DWOLLA_SECRET.includes('[REPLACE')) {
    console.error('❌ Placeholder credentials detected!');
    console.error('Please replace [REPLACE_WITH_YOUR_DWOLLA_KEY] with your actual Dwolla Key');
    console.error('Please replace [REPLACE_WITH_YOUR_DWOLLA_SECRET] with your actual Dwolla Secret');
    process.exit(1);
  }

  const authUrl = DWOLLA_ENVIRONMENT === 'production' 
    ? 'accounts.dwolla.com'
    : 'accounts-sandbox.dwolla.com';

  console.log(`🔐 Environment: ${DWOLLA_ENVIRONMENT}`);
  console.log(`🌐 Auth URL: https://${authUrl}`);
  console.log(`🔑 Using Key: ${DWOLLA_KEY.substring(0, 8)}...`);
  console.log(`🤐 Using Secret: ${DWOLLA_SECRET.substring(0, 8)}...\n`);

  // Prepare Basic Auth header
  const credentials = Buffer.from(`${DWOLLA_KEY}:${DWOLLA_SECRET}`).toString('base64');
  
  const postData = 'grant_type=client_credentials';

  const options = {
    hostname: authUrl,
    path: '/token',
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Content-Length': postData.length,
      'Authorization': `Basic ${credentials}`,
      'User-Agent': 'Unified-Customer-Dashboard/1.0'
    }
  };

  return new Promise((resolve, reject) => {
    console.log('📡 Making OAuth 2.0 token request...');

    const req = https.request(options, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        console.log(`📊 Response Status: ${res.statusCode}`);
        console.log(`📋 Response Headers:`, res.headers);

        if (res.statusCode === 200) {
          try {
            const tokenData = JSON.parse(data);
            console.log('\n✅ Authentication Successful!');
            console.log(`🎫 Access Token: ${tokenData.access_token.substring(0, 20)}...`);
            console.log(`⏰ Expires In: ${tokenData.expires_in} seconds`);
            console.log(`🎯 Token Type: ${tokenData.token_type}`);
            console.log(`🔒 Scope: ${tokenData.scope || 'Not specified'}`);

            // Test a simple API call with the token
            testApiCall(tokenData.access_token);
            resolve(tokenData);
          } catch (error) {
            console.error('\n❌ Error parsing token response:', error.message);
            console.error('Raw response:', data);
            reject(error);
          }
        } else {
          console.error(`\n❌ Authentication Failed (${res.statusCode})`);
          console.error('Response:', data);
          
          // Provide helpful error messages
          switch (res.statusCode) {
            case 400:
              console.error('\n🔍 Possible issues:');
              console.error('- Invalid request format');
              console.error('- Missing grant_type parameter');
              break;
            case 401:
              console.error('\n🔍 Possible issues:');
              console.error('- Invalid Key or Secret');
              console.error('- Credentials are for wrong environment (sandbox vs production)');
              console.error('- Application may be disabled or suspended');
              break;
            case 403:
              console.error('\n🔍 Possible issues:');
              console.error('- Application does not have required permissions');
              console.error('- Account may be suspended');
              break;
            default:
              console.error('\n🔍 Check Dwolla status page: https://status.dwolla.com/');
          }
          
          reject(new Error(`HTTP ${res.statusCode}: ${data}`));
        }
      });
    });

    req.on('error', (error) => {
      console.error('\n❌ Network Error:', error.message);
      console.error('\n🔍 Possible issues:');
      console.error('- No internet connection');
      console.error('- Firewall blocking HTTPS requests');
      console.error('- DNS resolution issues');
      reject(error);
    });

    req.write(postData);
    req.end();
  });
}

async function testApiCall(accessToken) {
  console.log('\n🧪 Testing API call with access token...');

  const apiUrl = DWOLLA_ENVIRONMENT === 'production' 
    ? 'api.dwolla.com'
    : 'api-sandbox.dwolla.com';

  const options = {
    hostname: apiUrl,
    path: '/root',  // Simple endpoint to test auth
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Accept': 'application/vnd.dwolla.v1.hal+json',
      'User-Agent': 'Unified-Customer-Dashboard/1.0'
    }
  };

  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        if (res.statusCode === 200) {
          console.log('✅ API call successful!');
          console.log('🎯 Your Dwolla integration is working correctly');
          
          try {
            const apiData = JSON.parse(data);
            console.log(`📋 Account ID: ${apiData.id || 'Not available'}`);
            console.log(`🏢 Account Name: ${apiData.name || 'Not available'}`);
          } catch (e) {
            console.log('📄 Response received (not JSON)');
          }
          
          resolve(data);
        } else {
          console.error(`❌ API call failed (${res.statusCode})`);
          console.error('Response:', data);
          reject(new Error(`API call failed: ${res.statusCode}`));
        }
      });
    });

    req.on('error', (error) => {
      console.error('❌ API call network error:', error.message);
      reject(error);
    });

    req.end();
  });
}

// Run the test
testDwollaAuth()
  .then(() => {
    console.log('\n🎉 All tests passed! Your Dwolla configuration is ready for production.');
    console.log('\n📝 Next steps:');
    console.log('1. Run: ./scripts/setup-production-apis.js');
    console.log('2. Start your app: npm run dev');
    console.log('3. Test searches with real data');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Test failed:', error.message);
    console.log('\n🔧 Troubleshooting:');
    console.log('1. Double-check your Dwolla Key and Secret');
    console.log('2. Ensure you\'re using the correct environment (sandbox vs production)');
    console.log('3. Verify your Dwolla application is active');
    console.log('4. Check Dwolla documentation: https://developers.dwolla.com/');
    process.exit(1);
  });
