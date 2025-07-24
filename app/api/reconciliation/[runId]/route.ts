import { NextRequest, NextResponse } from 'next/server'
import { getReconciliationReporter } from '@/lib/reconciliation/reconciliation-reporter'
import { requireAuth } from '@/lib/auth/api'
import { log } from '@/lib/logger'

/**
 * GET /api/reconciliation/[runId] - Get detailed reconciliation report
 * GET /api/reconciliation/[runId]/export - Export report as CSV
 */

export async function GET(
  request: NextRequest,
  { params }: { params: { runId: string } }
) {
  try {
    await requireAuth(request)
    
    const { runId } = params
    const isExport = request.nextUrl.pathname.endsWith('/export')
    
    const reporter = getReconciliationReporter()
    
    if (isExport) {
      // Generate CSV export
      const csv = await reporter.exportReportToCSV(runId)
      
      return new NextResponse(csv, {
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': `attachment; filename="reconciliation-${runId}.csv"`
        }
      })
    }
    
    // Generate detailed report
    const report = await reporter.generateReport(runId)
    
    return NextResponse.json({
      success: true,
      report
    })
    
  } catch (error) {
    log.error('Failed to get reconciliation report', error as Error)
    
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get report'
      },
      { status: 500 }
    )
  }
}