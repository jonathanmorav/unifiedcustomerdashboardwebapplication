import { NextRequest, NextResponse } from 'next/server'
import { getReconciliationEngine } from '@/lib/reconciliation/reconciliation-engine'
import { requireAuth } from '@/lib/auth/api'
import { log } from '@/lib/logger'

/**
 * POST /api/reconciliation/discrepancies/[discrepancyId]/resolve
 * Resolve a specific discrepancy
 */

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ discrepancyId: string }> }
) {
  try {
    await requireAuth(request)
    
    const { discrepancyId } = await params
    const body = await request.json()
    const { resolution } = body
    
    if (!resolution || !resolution.type) {
      return NextResponse.json(
        {
          success: false,
          error: 'Resolution type is required'
        },
        { status: 400 }
      )
    }
    
    const engine = getReconciliationEngine()
    const resolved = await engine.resolveDiscrepancy(discrepancyId, resolution)
    
    return NextResponse.json({
      success: true,
      discrepancy: resolved
    })
    
  } catch (error) {
    log.error('Failed to resolve discrepancy', error as Error)
    
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to resolve discrepancy'
      },
      { status: 500 }
    )
  }
}