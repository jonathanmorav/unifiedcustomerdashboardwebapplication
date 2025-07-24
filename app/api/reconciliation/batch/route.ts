import { NextRequest, NextResponse } from 'next/server'
import { getBatchReconciler } from '@/lib/reconciliation/batch-reconciler'
import { requireAuth } from '@/lib/auth/api'
import { log } from '@/lib/logger'

/**
 * POST /api/reconciliation/batch - Run batch reconciliation
 */

export async function POST(request: NextRequest) {
  try {
    await requireAuth(request)
    
    const body = await request.json()
    const { 
      resourceType, 
      startDate, 
      endDate,
      config,
      catchUp = false,
      daysBack = 30
    } = body
    
    const reconciler = getBatchReconciler()
    
    if (catchUp) {
      // Run catch-up reconciliation
      const results = await reconciler.performCatchUpReconciliation(
        resourceType,
        daysBack
      )
      
      return NextResponse.json({
        success: true,
        type: 'catch_up',
        results
      })
    }
    
    // Validate required fields
    if (!resourceType || !startDate || !endDate) {
      return NextResponse.json(
        {
          success: false,
          error: 'resourceType, startDate, and endDate are required'
        },
        { status: 400 }
      )
    }
    
    // Run batch reconciliation
    const results = await reconciler.performBatchReconciliation(
      resourceType,
      new Date(startDate),
      new Date(endDate),
      config
    )
    
    return NextResponse.json({
      success: true,
      type: 'batch',
      results
    })
    
  } catch (error) {
    log.error('Batch reconciliation failed', error as Error)
    
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Batch reconciliation failed'
      },
      { status: 500 }
    )
  }
}