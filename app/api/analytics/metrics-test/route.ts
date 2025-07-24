import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth/api'
import { log } from '@/lib/logger'
import { prisma } from '@/lib/db'

/**
 * GET /api/analytics/metrics-test - Test endpoint to debug metrics issues
 */
export async function GET(request: NextRequest) {
  try {
    await requireAuth(request)
    
    // Test basic database connection
    const testResults: any = {
      database: 'connected',
      queries: {}
    }
    
    try {
      // Test 1: Count webhook events
      testResults.queries.webhookEventCount = await prisma.webhookEvent.count()
    } catch (e) {
      testResults.queries.webhookEventCount = { error: (e as Error).message }
    }
    
    try {
      // Test 2: Count journey instances
      testResults.queries.journeyInstanceCount = await prisma.journeyInstance.count()
    } catch (e) {
      testResults.queries.journeyInstanceCount = { error: (e as Error).message }
    }
    
    try {
      // Test 3: Count webhook anomalies
      testResults.queries.webhookAnomalyCount = await prisma.webhookAnomaly.count()
    } catch (e) {
      testResults.queries.webhookAnomalyCount = { error: (e as Error).message }
    }
    
    try {
      // Test 4: Count reconciliation checks
      testResults.queries.reconciliationCheckCount = await prisma.reconciliationCheck.count()
    } catch (e) {
      testResults.queries.reconciliationCheckCount = { error: (e as Error).message }
    }
    
    // Test if realtime engine can be loaded
    try {
      const { getRealtimeAnalyticsEngine } = await import('@/lib/analytics/realtime-engine')
      const engine = getRealtimeAnalyticsEngine()
      testResults.realtimeEngine = 'loaded'
      testResults.dashboard = engine.getDashboard() ? 'available' : 'empty'
    } catch (e) {
      testResults.realtimeEngine = { error: (e as Error).message }
    }
    
    return NextResponse.json({
      success: true,
      test: true,
      results: testResults
    })
    
  } catch (error) {
    const errorDetails = {
      message: (error as Error).message,
      stack: process.env.NODE_ENV === 'development' ? (error as Error).stack : undefined,
      name: (error as Error).name
    }
    
    return NextResponse.json(
      {
        success: false,
        test: true,
        error: errorDetails
      },
      { status: 500 }
    )
  }
}