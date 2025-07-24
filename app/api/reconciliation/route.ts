import { NextRequest, NextResponse } from 'next/server'
import { getReconciliationEngine } from '@/lib/reconciliation/reconciliation-engine'
import { getReconciliationReporter } from '@/lib/reconciliation/reconciliation-reporter'
import { requireAuth } from '@/lib/auth/api'
import { log } from '@/lib/logger'

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