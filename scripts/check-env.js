#!/usr/bin/env node

/**
 * Environment Configuration Validator
 * Checks that all required environment variables are set and valid
 */

const fs = require('fs');
const path = require('path');
const { config } = require('dotenv');

// Load environment variables
const envPath = path.join(__dirname, '..', '.env.local');
const envExists = fs.existsSync(envPath);

if (!envExists && process.env.NODE_ENV !== 'production') {
  console.error('❌ .env.local file not found!');
  console.log('👉 Copy .env.local.example to .env.local and fill in your values');
  process.exit(1);
}

// Load the appropriate env file
if (process.env.NODE_ENV === 'production') {
  config({ path: '.env.production' });
} else if (process.env.NODE_ENV === 'staging') {
  config({ path: '.env.staging' });
} else {
  config({ path: '.env.local' });
}

// Define required and optional variables
const requiredVars = {
  // NextAuth
  NEXTAUTH_URL: {
    description: 'NextAuth URL',
    validator: (val) => val.startsWith('http'),
    example: 'http://localhost:3000',
  },
  NEXTAUTH_SECRET: {
    description: 'NextAuth Secret',
    validator: (val) => val.length >= 32,
    example: 'Generated with: openssl rand -base64 32',
  },
  
  // Database
  DATABASE_URL: {
    description: 'PostgreSQL connection string',
    validator: (val) => val.includes('postgresql://'),
    example: 'postgresql://user:password@localhost:5432/dbname',
  },
  
  // Google OAuth
  GOOGLE_CLIENT_ID: {
    description: 'Google OAuth Client ID',
    validator: (val) => val.endsWith('.apps.googleusercontent.com'),
    example: '123456789-abcdef.apps.googleusercontent.com',
  },
  GOOGLE_CLIENT_SECRET: {
    description: 'Google OAuth Client Secret',
    validator: (val) => val.length > 0,
    example: 'GOCSPX-...',
  },
  
  // Authorization
  AUTHORIZED_EMAILS: {
    description: 'Authorized email addresses',
    validator: (val) => val.includes('@') || val === '*',
    example: 'user@example.com,admin@example.com',
  },
};

const conditionalVars = {
  // Only required if not in demo mode
  HUBSPOT_API_KEY: {
    condition: () => process.env.DEMO_MODE !== 'true',
    description: 'HubSpot API Key',
    validator: (val) => val.startsWith('pat-') || val.length > 0,
    example: 'pat-na1-...',
  },
  DWOLLA_CLIENT_ID: {
    condition: () => process.env.DEMO_MODE !== 'true',
    description: 'Dwolla Client ID',
    validator: (val) => val.length > 0,
    example: 'Your Dwolla Client ID',
  },
  DWOLLA_CLIENT_SECRET: {
    condition: () => process.env.DEMO_MODE !== 'true',
    description: 'Dwolla Client Secret',
    validator: (val) => val.length > 0,
    example: 'Your Dwolla Client Secret',
  },
};

const optionalVars = {
  // Email configuration
  EMAIL_FROM_ADDRESS: {
    description: 'Email from address',
    validator: (val) => val.includes('@'),
    default: 'noreply@localhost',
  },
  SECURITY_TEAM_EMAILS: {
    description: 'Security team emails',
    validator: (val) => val.includes('@'),
    default: 'security@localhost',
  },
  
  // Performance
  RATE_LIMIT_REQUESTS_PER_MINUTE: {
    description: 'Rate limit per minute',
    validator: (val) => !isNaN(parseInt(val)),
    default: '60',
  },
  
  // Features
  DEMO_MODE: {
    description: 'Demo mode flag',
    validator: (val) => ['true', 'false'].includes(val),
    default: 'false',
  },
};

// Check function
function checkEnvVar(name, config, required = true) {
  const value = process.env[name];
  
  if (!value || value.trim() === '') {
    if (required) {
      return {
        valid: false,
        error: `Missing required variable: ${name}`,
        hint: config.example || config.description,
      };
    } else if (config.default) {
      process.env[name] = config.default;
      return { valid: true, warning: `Using default value for ${name}: ${config.default}` };
    }
    return { valid: true };
  }
  
  if (config.validator && !config.validator(value)) {
    return {
      valid: false,
      error: `Invalid value for ${name}`,
      hint: config.example || config.description,
      current: value.substring(0, 10) + '...',
    };
  }
  
  return { valid: true };
}

// Run checks
console.log('🔍 Checking environment configuration...\n');

let hasErrors = false;
let hasWarnings = false;

// Check required variables
console.log('📋 Required Variables:');
for (const [name, config] of Object.entries(requiredVars)) {
  const result = checkEnvVar(name, config, true);
  if (!result.valid) {
    console.log(`❌ ${name}: ${result.error}`);
    if (result.hint) console.log(`   💡 ${result.hint}`);
    hasErrors = true;
  } else {
    console.log(`✅ ${name}: ${config.description}`);
  }
}

// Check conditional variables
console.log('\n📋 Conditional Variables:');
for (const [name, config] of Object.entries(conditionalVars)) {
  if (config.condition && !config.condition()) {
    console.log(`⏭️  ${name}: Skipped (condition not met)`);
    continue;
  }
  
  const result = checkEnvVar(name, config, true);
  if (!result.valid) {
    console.log(`❌ ${name}: ${result.error}`);
    if (result.hint) console.log(`   💡 ${result.hint}`);
    hasErrors = true;
  } else {
    console.log(`✅ ${name}: ${config.description}`);
  }
}

// Check optional variables
console.log('\n📋 Optional Variables:');
for (const [name, config] of Object.entries(optionalVars)) {
  const result = checkEnvVar(name, config, false);
  if (result.warning) {
    console.log(`⚠️  ${name}: ${result.warning}`);
    hasWarnings = true;
  } else if (result.valid) {
    console.log(`✅ ${name}: ${config.description}`);
  }
}

// Database connection test
console.log('\n🔌 Testing database connection...');
const { Client } = require('pg');
const dbUrl = process.env.DATABASE_URL;

if (dbUrl) {
  const client = new Client({ connectionString: dbUrl });
  client.connect()
    .then(() => {
      console.log('✅ Database connection successful');
      client.end();
    })
    .catch((err) => {
      console.log('❌ Database connection failed:', err.message);
      console.log('   💡 Make sure PostgreSQL is running and the database exists');
      hasErrors = true;
    })
    .finally(() => {
      // Summary
      console.log('\n' + '='.repeat(50));
      if (hasErrors) {
        console.log('❌ Environment check failed! Please fix the errors above.');
        process.exit(1);
      } else if (hasWarnings) {
        console.log('⚠️  Environment check passed with warnings.');
        console.log('✅ You can proceed, but consider addressing the warnings.');
      } else {
        console.log('✅ Environment check passed! All required variables are set.');
      }
      console.log('='.repeat(50));
    });
} else {
  console.log('❌ DATABASE_URL not set, skipping connection test');
  
  // Summary without DB test
  console.log('\n' + '='.repeat(50));
  if (hasErrors) {
    console.log('❌ Environment check failed! Please fix the errors above.');
    process.exit(1);
  } else {
    console.log('✅ Environment check passed! All required variables are set.');
  }
  console.log('='.repeat(50));
}