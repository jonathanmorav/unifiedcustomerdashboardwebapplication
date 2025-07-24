import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth/api'
import { log } from '@/lib/logger'
import { prisma } from '@/lib/db'

/**
 * GET /api/analytics/reconciliation - Get reconciliation data
 */
export async function GET(request: NextRequest) {
  try {
    await requireAuth(request)
    
    const searchParams = request.nextUrl.searchParams
    const status = searchParams.get('status') || 'all'
    const checkType = searchParams.get('type') || 'all'
    
    // Get reconciliation checks
    const whereClause: any = {}
    
    if (status !== 'all') {
      whereClause.status = status
    }
    
    if (checkType !== 'all') {
      whereClause.checkType = checkType
    }
    
    const checks = await prisma.reconciliationCheck.findMany({
      where: whereClause,
      orderBy: { createdAt: 'desc' },
      take: 50,
      include: {
        discrepancies: {
          take: 5
        }
      }
    })
    
    // Get summary statistics
    const [
      totalChecks,
      pendingChecks,
      failedChecks,
      autoResolved,
      checkTypeStats
    ] = await Promise.all([
      // Total checks today
      prisma.reconciliationCheck.count({
        where: {
          createdAt: { gte: new Date(new Date().setHours(0, 0, 0, 0)) }
        }
      }),
      
      // Pending checks
      prisma.reconciliationCheck.count({
        where: { status: 'pending' }
      }),
      
      // Failed checks
      prisma.reconciliationCheck.count({
        where: { 
          status: 'failed',
          createdAt: { gte: new Date(new Date().setHours(0, 0, 0, 0)) }
        }
      }),
      
      // Auto-resolved
      prisma.reconciliationCheck.count({
        where: {
          status: 'resolved',
          resolvedBy: 'system',
          createdAt: { gte: new Date(new Date().setHours(0, 0, 0, 0)) }
        }
      }),
      
      // Check type breakdown
      prisma.reconciliationCheck.groupBy({
        by: ['checkType'],
        where: {
          createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }
        },
        _count: true
      })
    ])
    
    // Calculate health score
    const successfulChecks = totalChecks - failedChecks
    const healthScore = totalChecks > 0 
      ? Math.round((successfulChecks / totalChecks) * 100)
      : 100
    
    // Get discrepancy rate
    const discrepancyStats = await prisma.reconciliationCheck.aggregate({
      where: {
        createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }
      },
      _avg: { discrepancyCount: true }
    })
    
    const checkTypes: Record<string, number> = {}
    checkTypeStats.forEach(item => {
      checkTypes[item.checkType] = item._count
    })
    
    return NextResponse.json({
      success: true,
      summary: {
        totalChecks,
        pendingChecks,
        failedChecks,
        autoResolved,
        healthScore,
        avgDiscrepancies: Math.round(discrepancyStats._avg.discrepancyCount || 0),
        checkTypes
      },
      checks: checks.map(check => ({
        id: check.id,
        checkType: check.checkType,
        status: check.status,
        recordCount: check.recordCount,
        discrepancyCount: check.discrepancyCount,
        startTime: check.startTime,
        endTime: check.endTime,
        createdAt: check.createdAt,
        metadata: check.metadata,
        discrepancies: check.discrepancies.map(d => ({
          id: d.id,
          field: d.field,
          dwollaValue: d.dwollaValue,
          localValue: d.localValue,
          resolved: d.resolved
        }))
      }))
    })
    
  } catch (error) {
    log.error('Failed to get reconciliation data', error as Error)
    
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to get reconciliation data',
        summary: {
          totalChecks: 0,
          pendingChecks: 0,
          failedChecks: 0,
          autoResolved: 0,
          healthScore: 100,
          avgDiscrepancies: 0,
          checkTypes: {}
        },
        checks: []
      },
      { status: 500 }
    )
  }
}