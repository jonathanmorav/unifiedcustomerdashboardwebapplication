/**
 * Premium Reconciliation API Endpoint
 * 
 * Handles requests for premium reconciliation operations including
 * running reconciliation jobs and retrieving reports.
 */

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { PremiumReconciliationEngine } from '@/lib/reconciliation/premium-reconciliation-engine'
import { prisma } from '@/lib/db'
import { log } from '@/lib/logger'
import { rateLimiter, rateLimitConfigs, logRateLimitViolation } from '@/lib/security/rate-limit'
import type { ReconciliationJobResponse } from '@/lib/types/reconciliation'

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const jobId = searchParams.get('jobId')
    const billingPeriod = searchParams.get('billingPeriod')
    const carrier = searchParams.get('carrier')
    const status = searchParams.get('status')

    // If jobId is provided, return specific job details
    if (jobId) {
      const job = await prisma.reconciliationJob.findUnique({
        where: { id: jobId }
      })

      if (!job) {
        return NextResponse.json({ error: 'Job not found' }, { status: 404 })
      }

      const response: ReconciliationJobResponse = {
        jobId: job.id,
        status: job.status as any,
        startedAt: job.startedAt || job.createdAt,
        completedAt: job.completedAt || undefined,
        report: job.results ? (job.results as any).report : undefined,
        validationResult: job.results ? (job.results as any).validation : undefined,
        carrierFiles: job.results ? (job.results as any).carrierFiles : undefined,
        error: job.errors ? (job.errors as any).message : undefined
      }

      return NextResponse.json(response)
    }

    // Otherwise, return list of reconciliation jobs with optional filtering
    const whereClause: any = {
      type: 'premium_reconciliation'
    }

    if (billingPeriod) {
      whereClause.config = {
        path: ['billingPeriod'],
        equals: billingPeriod
      }
    }

    if (status) {
      whereClause.status = status
    }

    const jobs = await prisma.reconciliationJob.findMany({
      where: whereClause,
      orderBy: { createdAt: 'desc' },
      take: 50
    })

    const jobResponses: ReconciliationJobResponse[] = jobs.map(job => ({
      jobId: job.id,
      status: job.status as any,
      startedAt: job.startedAt || job.createdAt,
      completedAt: job.completedAt || undefined,
      report: job.results ? (job.results as any).report : undefined,
      validationResult: job.results ? (job.results as any).validation : undefined,
      error: job.errors ? (job.errors as any).message : undefined
    }))

    return NextResponse.json({ jobs: jobResponses })

  } catch (error) {
    log.error('Error fetching reconciliation data', error as Error, {
      operation: 'get_reconciliation_data'
    })
    
    return NextResponse.json(
      { error: 'Failed to fetch reconciliation data' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Apply rate limiting for premium reconciliation operations
    const rateLimitResult = await rateLimiter.limit(request, {
      ...rateLimitConfigs.premiumReconciliation,
      name: 'premium-reconciliation',
      keyGenerator: (req) => `user:${session.user?.email || 'unknown'}`,
      onLimitReached: async (req, key) => {
        await logRateLimitViolation(req, '/api/reconciliation/premium', key)
      },
    })

    if (!rateLimitResult.success) {
      return NextResponse.json(
        {
          error: 'Too many premium reconciliation requests. Please wait before trying again.',
          retryAfter: rateLimitResult.retryAfter,
        },
        { 
          status: 429,
          headers: {
            'Retry-After': String(rateLimitResult.retryAfter || 900),
            'X-RateLimit-Limit': String(rateLimitResult.limit),
            'X-RateLimit-Remaining': String(rateLimitResult.remaining),
            'X-RateLimit-Reset': rateLimitResult.reset.toISOString(),
          },
        }
      )
    }

    const body = await request.json()
    const { 
      billingPeriod, 
      dateRange, 
      includePending = false,
      forceRun = false 
    } = body

    if (!billingPeriod) {
      return NextResponse.json(
        { error: 'billingPeriod is required' },
        { status: 400 }
      )
    }

    // Check if a recent job for this billing period already exists
    if (!forceRun) {
      const existingJob = await prisma.reconciliationJob.findFirst({
        where: {
          type: 'premium_reconciliation',
          status: { in: ['pending', 'running'] },
          config: {
            path: ['billingPeriod'],
            equals: billingPeriod
          }
        }
      })

      if (existingJob) {
        return NextResponse.json({
          jobId: existingJob.id,
          status: existingJob.status,
          message: 'A reconciliation job for this billing period is already in progress'
        })
      }
    }

    // Create new reconciliation job
    const job = await prisma.reconciliationJob.create({
      data: {
        type: 'premium_reconciliation',
        status: 'pending',
        config: {
          billingPeriod,
          dateRange,
          includePending,
          forceRun
        },
        createdBy: session.user?.email || 'unknown'
      }
    })

    // Start reconciliation process asynchronously
    processReconciliationJob(job.id, billingPeriod, { dateRange, includePending })
      .catch(error => {
        log.error('Background reconciliation job failed', error as Error, {
          jobId: job.id,
          billingPeriod
        })
      })

    const response: ReconciliationJobResponse = {
      jobId: job.id,
      status: 'pending',
      startedAt: job.createdAt
    }

    return NextResponse.json(response, { status: 201 })

  } catch (error) {
    log.error('Error starting reconciliation job', error as Error, {
      operation: 'start_reconciliation_job'
    })
    
    return NextResponse.json(
      { error: 'Failed to start reconciliation job' },
      { status: 500 }
    )
  }
}

/**
 * Background function to process reconciliation job
 */
async function processReconciliationJob(
  jobId: string,
  billingPeriod: string,
  options: { dateRange?: { start: string; end: string }; includePending?: boolean }
) {
  try {
    // Update job status to running
    await prisma.reconciliationJob.update({
      where: { id: jobId },
      data: {
        status: 'running',
        startedAt: new Date()
      }
    })

    const engine = new PremiumReconciliationEngine()
    
    // Convert string dates to Date objects if provided
    const processedOptions = {
      ...options,
      dateRange: options.dateRange ? {
        start: new Date(options.dateRange.start),
        end: new Date(options.dateRange.end)
      } : undefined
    }

    const { report, validation, carrierFiles } = await engine.runPremiumReconciliation(
      billingPeriod,
      processedOptions
    )

    // Update job with results
    await prisma.reconciliationJob.update({
      where: { id: jobId },
      data: {
        status: validation.isValid ? 'completed' : 'failed',
        completedAt: new Date(),
        results: {
          report,
          validation,
          carrierFiles
        },
        errors: validation.errors.length > 0 ? {
          message: 'Validation errors found',
          errors: validation.errors
        } : null
      }
    })

    log.info('Reconciliation job completed successfully', {
      jobId,
      billingPeriod,
      isValid: validation.isValid,
      totalCollected: report.totalCollected,
      carrierCount: carrierFiles.length
    })

  } catch (error) {
    // Update job with error status
    await prisma.reconciliationJob.update({
      where: { id: jobId },
      data: {
        status: 'failed',
        completedAt: new Date(),
        errors: {
          message: error instanceof Error ? error.message : 'Unknown error',
          stack: error instanceof Error ? error.stack : undefined
        }
      }
    })

    log.error('Reconciliation job failed', error as Error, {
      jobId,
      billingPeriod
    })

    throw error
  }
}