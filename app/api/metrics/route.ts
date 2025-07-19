import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { metrics } from '@/lib/monitoring/metrics'
import { log } from '@/lib/logger'

/**
 * GET /api/metrics
 * Prometheus-compatible metrics endpoint
 * Requires authentication and admin role
 */
export async function GET(request: NextRequest) {
  try {
    // Check authentication
    const session = await getServerSession(authOptions)
    
    if (!session?.user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }
    
    // Check admin role
    if (session.user.role !== 'ADMIN') {
      log.security('Unauthorized metrics access attempt', session.user.id, {
        role: session.user.role,
        operation: 'metrics_access'
      })
      
      return NextResponse.json(
        { error: 'Forbidden' },
        { status: 403 }
      )
    }
    
    // Get metrics in Prometheus format
    const metricsData = metrics.getPrometheusMetrics()
    
    // Return with proper content type for Prometheus
    return new NextResponse(metricsData, {
      status: 200,
      headers: {
        'Content-Type': 'text/plain; version=0.0.4',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
      },
    })
  } catch (error) {
    log.error('Metrics endpoint error', error as Error, {
      operation: 'metrics_endpoint'
    })
    
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}