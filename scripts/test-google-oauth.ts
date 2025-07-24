#!/usr/bin/env tsx

console.log('🔍 Google OAuth Configuration Check\n')

// Check environment variables
const config = {
  NEXTAUTH_URL: process.env.NEXTAUTH_URL || 'NOT SET',
  GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID || 'NOT SET',
  GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET ? 'SET' : 'NOT SET',
  AUTHORIZED_EMAILS: process.env.AUTHORIZED_EMAILS || 'NOT SET'
}

console.log('1. Environment Configuration:')
Object.entries(config).forEach(([key, value]) => {
  console.log(`   ${key}: ${value}`)
})

console.log('\n2. OAuth URLs:')
const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000'
console.log(`   Sign In URL: ${baseUrl}/api/auth/signin`)
console.log(`   Callback URL: ${baseUrl}/api/auth/callback/google`)
console.log(`   Session URL: ${baseUrl}/api/auth/session`)

console.log('\n3. Google OAuth Console Configuration:')
console.log('   Make sure these are added to your Google OAuth app:')
console.log('   \n   Authorized JavaScript origins:')
console.log(`   - ${baseUrl}`)
console.log('   - http://localhost:3000 (if different)')
console.log('   \n   Authorized redirect URIs:')
console.log(`   - ${baseUrl}/api/auth/callback/google`)
console.log('   - http://localhost:3000/api/auth/callback/google (if different)')

console.log('\n4. Common Issues:')
console.log('   ❓ Is your Google OAuth app in "Production" mode?')
console.log('   ❓ Are all redirect URIs exactly matching (no trailing slashes)?')
console.log('   ❓ Is the OAuth consent screen configured?')
console.log('   ❓ Are you using the correct Client ID and Secret?')

console.log('\n5. Debug Steps:')
console.log('   1. Open Chrome DevTools Network tab')
console.log('   2. Check "Preserve log"')
console.log('   3. Try signing in again')
console.log('   4. Look for the redirect to accounts.google.com')
console.log('   5. Check if there\'s a redirect back to your callback URL')
console.log('   6. Look for any error parameters in the URL')

console.log('\n6. Test Direct Callback:')
console.log(`   Try visiting: ${baseUrl}/api/auth/callback/test?code=test&state=test`)
console.log('   This should return JSON with the request details')