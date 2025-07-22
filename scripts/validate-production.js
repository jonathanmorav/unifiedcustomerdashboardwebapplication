#!/usr/bin/env node

/**
 * Production Configuration Validator
 * 
 * This script validates that all required environment variables
 * are set for production deployment.
 * 
 * Usage: node scripts/validate-production.js
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

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

// Required environment variables
const REQUIRED_VARS = [
  { name: 'NEXTAUTH_URL', validate: (v) => v.startsWith('https://'), error: 'Must be an HTTPS URL' },
  { name: 'NEXTAUTH_SECRET', validate: (v) => v.length >= 32, error: 'Must be at least 32 characters' },
  { name: 'APP_URL', validate: (v) => v.startsWith('https://'), error: 'Must be an HTTPS URL' },
  { name: 'GOOGLE_CLIENT_ID', validate: (v) => v.includes('.apps.googleusercontent.com'), error: 'Invalid Google Client ID format' },
  { name: 'GOOGLE_CLIENT_SECRET', validate: (v) => v.startsWith('GOCSPX-'), error: 'Invalid Google Client Secret format' },
  { name: 'DATABASE_URL', validate: (v) => v.includes('sslmode=require'), error: 'Must include sslmode=require for production' },
  { name: 'AUTHORIZED_EMAILS', validate: (v) => v.includes('@'), error: 'Must contain valid email addresses' },
  { name: 'HUBSPOT_API_KEY', validate: (v) => v.startsWith('pat-'), error: 'Must be a valid HubSpot private app key' },
  { name: 'DWOLLA_KEY', validate: (v) => v.length > 0, error: 'Cannot be empty' },
  { name: 'DWOLLA_SECRET', validate: (v) => v.length > 0, error: 'Cannot be empty' },
  { name: 'DWOLLA_ENVIRONMENT', validate: (v) => v === 'production', error: 'Must be "production"' },
  { name: 'DEMO_MODE', validate: (v) => v === 'false', error: 'Must be "false" in production' },
  { name: 'NEXT_PUBLIC_DEMO_MODE', validate: (v) => v === 'false', error: 'Must be "false" in production' },
];

// Recommended environment variables
const RECOMMENDED_VARS = [
  'PASSWORD_PEPPER',
  'CSP_REPORT_URI',
  'SENTRY_DSN',
  'ENABLE_AUDIT_LOGGING',
  'REDIS_URL',
  'BACKUP_ENCRYPTION_KEY',
];

// Security checks
const SECURITY_CHECKS = [
  { 
    name: 'HTTPS URLs',
    check: () => {
      const urls = ['NEXTAUTH_URL', 'APP_URL'];
      return urls.every(key => process.env[key]?.startsWith('https://'));
    }
  },
  {
    name: 'Strong Secrets',
    check: () => {
      const secret = process.env.NEXTAUTH_SECRET || '';
      return secret.length >= 32 && !/^[a-zA-Z0-9]+$/.test(secret);
    }
  },
  {
    name: 'Production Database',
    check: () => {
      const dbUrl = process.env.DATABASE_URL || '';
      return dbUrl.includes('sslmode=require') && !dbUrl.includes('localhost');
    }
  },
  {
    name: 'API Configuration',
    check: () => {
      return process.env.DWOLLA_ENVIRONMENT === 'production' && 
             process.env.DWOLLA_BASE_URL === 'https://api.dwolla.com';
    }
  },
];

// Load environment variables
function loadEnv() {
  const envPath = path.join(process.cwd(), '.env.production.local');
  
  if (!fs.existsSync(envPath)) {
    console.log(`${colors.yellow}⚠️  Warning: .env.production.local not found${colors.reset}`);
    console.log(`${colors.cyan}ℹ️  Looking for environment variables in current process...${colors.reset}\n`);
    return false;
  }
  
  const envContent = fs.readFileSync(envPath, 'utf8');
  envContent.split('\n').forEach(line => {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#')) {
      const [key, ...valueParts] = trimmed.split('=');
      const value = valueParts.join('=').replace(/^["']|["']$/g, '');
      process.env[key] = value;
    }
  });
  
  return true;
}

// Validate configuration
function validateConfig() {
  console.log(`${colors.blue}🔍 Validating Production Configuration${colors.reset}\n`);
  
  let hasErrors = false;
  let hasWarnings = false;
  
  // Check required variables
  console.log(`${colors.cyan}Required Environment Variables:${colors.reset}`);
  REQUIRED_VARS.forEach(({ name, validate, error }) => {
    const value = process.env[name];
    
    if (!value || value.trim() === '') {
      console.log(`${colors.red}❌ ${name}: Not set${colors.reset}`);
      hasErrors = true;
    } else if (!validate(value)) {
      console.log(`${colors.red}❌ ${name}: ${error}${colors.reset}`);
      hasErrors = true;
    } else {
      console.log(`${colors.green}✅ ${name}: Valid${colors.reset}`);
    }
  });
  
  // Check recommended variables
  console.log(`\n${colors.cyan}Recommended Environment Variables:${colors.reset}`);
  RECOMMENDED_VARS.forEach(name => {
    const value = process.env[name];
    
    if (!value || value.trim() === '') {
      console.log(`${colors.yellow}⚠️  ${name}: Not set (recommended for production)${colors.reset}`);
      hasWarnings = true;
    } else {
      console.log(`${colors.green}✅ ${name}: Set${colors.reset}`);
    }
  });
  
  // Run security checks
  console.log(`\n${colors.cyan}Security Checks:${colors.reset}`);
  SECURITY_CHECKS.forEach(({ name, check }) => {
    if (check()) {
      console.log(`${colors.green}✅ ${name}: Passed${colors.reset}`);
    } else {
      console.log(`${colors.red}❌ ${name}: Failed${colors.reset}`);
      hasErrors = true;
    }
  });
  
  // Additional checks
  console.log(`\n${colors.cyan}Additional Checks:${colors.reset}`);
  
  // Check Node version
  const nodeVersion = process.version;
  const majorVersion = parseInt(nodeVersion.split('.')[0].substring(1));
  if (majorVersion >= 18) {
    console.log(`${colors.green}✅ Node.js version: ${nodeVersion} (18+ required)${colors.reset}`);
  } else {
    console.log(`${colors.red}❌ Node.js version: ${nodeVersion} (18+ required)${colors.reset}`);
    hasErrors = true;
  }
  
  // Summary
  console.log('\n' + '='.repeat(50));
  if (hasErrors) {
    console.log(`${colors.red}❌ Configuration validation FAILED${colors.reset}`);
    console.log(`${colors.red}Please fix the errors above before deploying to production.${colors.reset}`);
    process.exit(1);
  } else if (hasWarnings) {
    console.log(`${colors.yellow}⚠️  Configuration validation passed with warnings${colors.reset}`);
    console.log(`${colors.yellow}Consider addressing the warnings for optimal security.${colors.reset}`);
  } else {
    console.log(`${colors.green}✅ Configuration validation PASSED${colors.reset}`);
    console.log(`${colors.green}Your configuration is ready for production deployment!${colors.reset}`);
  }
  
  // Generate summary report
  generateReport(hasErrors, hasWarnings);
}

// Generate validation report
function generateReport(hasErrors, hasWarnings) {
  const reportPath = path.join(process.cwd(), 'production-validation-report.txt');
  const timestamp = new Date().toISOString();
  
  let report = `Production Configuration Validation Report
Generated: ${timestamp}
Status: ${hasErrors ? 'FAILED' : hasWarnings ? 'PASSED WITH WARNINGS' : 'PASSED'}

Environment Variables:
`;
  
  REQUIRED_VARS.forEach(({ name }) => {
    const value = process.env[name];
    const masked = value ? maskSensitive(name, value) : 'NOT SET';
    report += `${name}: ${masked}\n`;
  });
  
  report += '\nRecommended Variables:\n';
  RECOMMENDED_VARS.forEach(name => {
    const value = process.env[name];
    const masked = value ? maskSensitive(name, value) : 'NOT SET';
    report += `${name}: ${masked}\n`;
  });
  
  fs.writeFileSync(reportPath, report);
  console.log(`\n${colors.cyan}📄 Validation report saved to: ${reportPath}${colors.reset}`);
}

// Mask sensitive values
function maskSensitive(name, value) {
  const sensitiveKeys = ['SECRET', 'PASSWORD', 'KEY', 'TOKEN'];
  const shouldMask = sensitiveKeys.some(key => name.includes(key));
  
  if (shouldMask) {
    return value.substring(0, 4) + '*'.repeat(Math.min(value.length - 4, 20));
  }
  
  return value;
}

// Main execution
if (require.main === module) {
  console.log(`${colors.magenta}🚀 Production Configuration Validator${colors.reset}\n`);
  
  const envLoaded = loadEnv();
  if (!envLoaded) {
    console.log(`${colors.cyan}Tip: Create .env.production.local from .env.production template${colors.reset}\n`);
  }
  
  validateConfig();
}