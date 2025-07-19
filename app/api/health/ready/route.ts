import { NextRequest, NextResponse } from 'next/server'
import { HealthCheckService } from '@/lib/monitoring/health-check'
import { log } from '@/lib/logger'

/**
 * GET /api/health/ready
 * Kubernetes readiness probe endpoint
 * Returns 200 if the service is ready to handle traffic
 * Returns 503 if critical dependencies are unavailable
 */
export async function GET(request: NextRequest) {
  try {
    const readiness = await HealthCheckService.checkReadiness()
    
    if (!readiness.ready) {
      log.warn('Service not ready', {
        errors: readiness.errors,
        operation: 'readiness_check'
      })
      
      return NextResponse.json(readiness, { status: 503 })
    }
    
    return NextResponse.json(readiness, { status: 200 })
  } catch (error) {
    log.error('Readiness check failed', error as Error, {
      operation: 'readiness_check'
    })
    
    return NextResponse.json(
      {
        ready: false,
        status: 'error',
        timestamp: new Date().toISOString(),
        errors: ['Readiness check failed'],
      },
      { status: 503 }
    )
  }
}