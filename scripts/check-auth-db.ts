#!/usr/bin/env tsx

import { prisma } from '../lib/db'

async function checkAuthDatabase() {
  console.log('🔍 Checking Authentication Database...\n')

  try {
    // 1. Check Users
    console.log('1. Users:')
    const users = await prisma.user.findMany({
      select: {
        id: true,
        email: true,
        name: true,
        createdAt: true,
        role: true
      }
    })
    
    if (users.length === 0) {
      console.log('   No users found')
    } else {
      users.forEach(user => {
        console.log(`   - ${user.email} (${user.role}) - Created: ${user.createdAt.toLocaleDateString()}`)
      })
    }
    console.log()

    // 2. Check Accounts
    console.log('2. OAuth Accounts:')
    const accounts = await prisma.account.findMany({
      select: {
        id: true,
        provider: true,
        type: true,
        userId: true,
        user: {
          select: { email: true }
        }
      }
    })
    
    if (accounts.length === 0) {
      console.log('   No OAuth accounts found')
    } else {
      accounts.forEach(account => {
        console.log(`   - ${account.provider} (${account.type}) for ${account.user.email}`)
      })
    }
    console.log()

    // 3. Check Sessions
    console.log('3. Active Sessions:')
    const sessions = await prisma.session.findMany({
      select: {
        id: true,
        expires: true,
        userId: true,
        user: {
          select: { email: true }
        }
      }
    })
    
    const activeSessions = sessions.filter(s => s.expires > new Date())
    if (activeSessions.length === 0) {
      console.log('   No active sessions found')
    } else {
      activeSessions.forEach(session => {
        console.log(`   - ${session.user.email} - Expires: ${session.expires.toLocaleString()}`)
      })
    }
    console.log()

    // 4. Check Audit Logs
    console.log('4. Recent Auth Logs:')
    const logs = await prisma.auditLog.findMany({
      where: {
        action: 'USER_LOGIN'
      },
      orderBy: { createdAt: 'desc' },
      take: 5,
      select: {
        createdAt: true,
        userId: true,
        metadata: true
      }
    })
    
    if (logs.length === 0) {
      console.log('   No login logs found')
    } else {
      logs.forEach(log => {
        const metadata = log.metadata as any
        console.log(`   - ${metadata?.email || 'Unknown'} - ${log.createdAt.toLocaleString()}`)
      })
    }

  } catch (error) {
    console.error('❌ Database error:', error)
  } finally {
    await prisma.$disconnect()
  }
}

// Run the check
checkAuthDatabase()