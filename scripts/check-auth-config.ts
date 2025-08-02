#!/usr/bin/env tsx

import { getEnv, isAuthorizedEmail } from '../lib/env'
import { prisma } from '../lib/db'

async function checkAuthConfig() {
  console.log('🔍 Checking Authentication Configuration...\n')

  try {
    // 1. Check environment variables
    console.log('1. Environment Variables:')
    const env = getEnv()
    
    console.log(`   NEXTAUTH_URL: ${env.NEXTAUTH_URL || '❌ NOT SET'}`)
    console.log(`   NEXTAUTH_SECRET: ${env.NEXTAUTH_SECRET ? '✅ Set' : '❌ NOT SET'}`)
    console.log(`   GOOGLE_CLIENT_ID: ${env.GOOGLE_CLIENT_ID ? '✅ Set' : '❌ NOT SET'}`)
    console.log(`   GOOGLE_CLIENT_SECRET: ${env.GOOGLE_CLIENT_SECRET ? '✅ Set' : '❌ NOT SET'}`)
    console.log(`   AUTHORIZED_EMAILS: ${env.AUTHORIZED_EMAILS || '❌ NOT SET'}`)
    console.log()

    // 2. Check database connection
    console.log('2. Database Connection:')
    try {
      await prisma.$connect()
      console.log('   ✅ Connected to database')
      
      // Check if User table exists
      const userCount = await prisma.user.count()
      console.log(`   ✅ User table exists (${userCount} users)`)
      
      // Check if Account table exists
      const accountCount = await prisma.account.count()
      console.log(`   ✅ Account table exists (${accountCount} accounts)`)
      
      // Check if Session table exists
      const sessionCount = await prisma.session.count()
      console.log(`   ✅ Session table exists (${sessionCount} sessions)`)
    } catch (error) {
      console.log('   ❌ Database error:', error)
    }
    console.log()

    // 3. Check authorized emails
    console.log('3. Authorized Emails:')
    const emails = Array.isArray(env.AUTHORIZED_EMAILS) ? env.AUTHORIZED_EMAILS : 
                   (typeof env.AUTHORIZED_EMAILS === 'string' ? (env.AUTHORIZED_EMAILS as string).split(',').map((e: string) => e.trim()) : [])
    if (emails.length === 0) {
      console.log('   ❌ No authorized emails configured')
    } else {
      emails.forEach((email: string) => {
        console.log(`   - ${email} ${isAuthorizedEmail(email) ? '✅' : '❌'}`)
      })
    }
    console.log()

    // 4. Check callback URLs
    console.log('4. OAuth Callback URLs:')
    const baseUrl = env.NEXTAUTH_URL || 'http://localhost:3000'
    console.log(`   Google OAuth Callback: ${baseUrl}/api/auth/callback/google`)
    console.log('   ⚠️  Make sure this URL is added to your Google OAuth app')
    console.log()

    // 5. Common issues
    console.log('5. Common Issues to Check:')
    console.log('   - Google OAuth app is in production mode (not testing)')
    console.log('   - Authorized redirect URIs include the callback URL')
    console.log('   - OAuth consent screen is configured')
    console.log('   - Your email is in AUTHORIZED_EMAILS')
    console.log('   - NEXTAUTH_SECRET is a strong random string')
    console.log('   - No trailing slashes in NEXTAUTH_URL')
    console.log()

    // 6. Generate test secret if needed
    if (!env.NEXTAUTH_SECRET) {
      console.log('6. Generate NEXTAUTH_SECRET:')
      console.log('   Run: openssl rand -base64 32')
      console.log('   Then add to your .env file')
    }

  } catch (error) {
    console.error('❌ Error:', error)
  } finally {
    await prisma.$disconnect()
  }
}

// Run the check
checkAuthConfig()