import { NextRequest, NextResponse } from 'next/server'
import { getReconciliationEngine } from '@/lib/reconciliation/reconciliation-engine'
import { getReconciliationReporter } from '@/lib/reconciliation/reconciliation-reporter'
import { requireAuth } from '@/lib/auth/api'
import { log } from '@/lib/logger'
import { rateLimiter, rateLimitConfigs, logRateLimitViolation } from '@/lib/security/rate-limit'

/**
 * GET /api/reconciliation - Get reconciliation history
 * POST /api/reconciliation - Start a new reconciliation run
 */

export async function GET(request: NextRequest) {
  try {
    await requireAuth(request)
    
    const searchParams = request.nextUrl.searchParams
    const hours = parseInt(searchParams.get('hours') || '24')
    const runId = searchParams.get('runId')
    
    // If specific run requested, generate report
    if (runId) {
      const reporter = getReconciliationReporter()
      const report = await reporter.generateReport(runId)
      
      return NextResponse.json({
        success: true,
        report
      })
    }
    
    // Otherwise return history
    const engine = getReconciliationEngine()
    const history = await engine.getReconciliationHistory(hours)
    
    return NextResponse.json({
      success: true,
      runs: history,
      count: history.length
    })
    
  } catch (error) {
    log.error('Failed to get reconciliation history', error as Error)
    
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to get reconciliation history'
      },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    await requireAuth(request)
    
    // Apply rate limiting for reconciliation operations
    const rateLimitResult = await rateLimiter.limit(request, {
      ...rateLimitConfigs.reconciliation,
      name: 'reconciliation',
      onLimitReached: async (req, key) => {
        await logRateLimitViolation(req, '/api/reconciliation', key)
      },
    })

    if (!rateLimitResult.success) {
      return NextResponse.json(
        {
          success: false,
          error: 'Too many reconciliation requests',
          retryAfter: rateLimitResult.retryAfter,
        },
        { 
          status: 429,
          headers: {
            'Retry-After': String(rateLimitResult.retryAfter || 60),
            'X-RateLimit-Limit': String(rateLimitResult.limit),
            'X-RateLimit-Remaining': String(rateLimitResult.remaining),
            'X-RateLimit-Reset': rateLimitResult.reset.toISOString(),
          },
        }
      )
    }
    
    const body = await request.json()
    const { configName, forceRun = false } = body
    
    const engine = getReconciliationEngine()
    const run = await engine.runReconciliation(configName, forceRun)
    
    return NextResponse.json({
      success: true,
      run
    })
    
  } catch (error) {
    log.error('Failed to start reconciliation', error as Error)
    
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to start reconciliation'
      },
      { status: 500 }
    )
  }
}