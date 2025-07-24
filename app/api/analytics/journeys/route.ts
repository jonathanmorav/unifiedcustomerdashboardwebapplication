import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth/api'
import { log } from '@/lib/logger'
import { prisma } from '@/lib/db'

/**
 * GET /api/analytics/journeys - Get journey analytics data
 */
export async function GET(request: NextRequest) {
  try {
    await requireAuth(request)
    
    const searchParams = request.nextUrl.searchParams
    const journeyType = searchParams.get('type') || 'all'
    const statusFilter = searchParams.get('status') || 'all'
    
    const now = new Date()
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    
    // Build where clause
    const whereClause: any = {}
    
    if (journeyType !== 'all') {
      whereClause.definition = {
        name: { contains: journeyType }
      }
    }
    
    if (statusFilter !== 'all') {
      whereClause.status = statusFilter
    }
    
    // Get summary statistics
    const [
      activeJourneys,
      completedToday,
      failedToday,
      abandonedToday,
      avgCompletionStats
    ] = await Promise.all([
      prisma.journeyInstance.count({
        where: { status: 'active' }
      }),
      
      prisma.journeyInstance.count({
        where: {
          status: 'completed',
          endTime: { gte: todayStart }
        }
      }),
      
      prisma.journeyInstance.count({
        where: {
          status: 'failed',
          endTime: { gte: todayStart }
        }
      }),
      
      prisma.journeyInstance.count({
        where: {
          status: 'abandoned',
          endTime: { gte: todayStart }
        }
      }),
      
      prisma.journeyInstance.aggregate({
        where: {
          status: 'completed',
          totalDurationMs: { not: null }
        },
        _avg: { totalDurationMs: true }
      })
    ])
    
    const totalToday = completedToday + failedToday + abandonedToday
    const successRate = totalToday > 0 
      ? (completedToday / totalToday) * 100 
      : 0
    
    // Get journey types breakdown
    const journeyDefinitions = await prisma.eventJourneyDefinition.findMany({
      where: { active: true }
    })
    
    const journeyTypes = await Promise.all(
      journeyDefinitions.map(async (def) => {
        const [active, completed, failed, abandoned, avgDuration] = await Promise.all([
          prisma.journeyInstance.count({
            where: {
              definitionId: def.id,
              status: 'active'
            }
          }),
          
          prisma.journeyInstance.count({
            where: {
              definitionId: def.id,
              status: 'completed',
              endTime: { gte: todayStart }
            }
          }),
          
          prisma.journeyInstance.count({
            where: {
              definitionId: def.id,
              status: 'failed',
              endTime: { gte: todayStart }
            }
          }),
          
          prisma.journeyInstance.count({
            where: {
              definitionId: def.id,
              status: 'abandoned',
              endTime: { gte: todayStart }
            }
          }),
          
          prisma.journeyInstance.aggregate({
            where: {
              definitionId: def.id,
              status: 'completed',
              totalDurationMs: { not: null }
            },
            _avg: { totalDurationMs: true }
          })
        ])
        
        const total = completed + failed + abandoned
        const successRate = total > 0 ? (completed / total) * 100 : 0
        
        return {
          name: def.name,
          active,
          completed,
          failed,
          abandoned,
          avgDuration: Number(avgDuration._avg.totalDurationMs || 0),
          successRate: parseFloat(successRate.toFixed(1))
        }
      })
    )
    
    // Get active journeys with details
    const activeJourneyInstances = await prisma.journeyInstance.findMany({
      where: {
        ...whereClause,
        status: { in: ['active', 'stuck'] }
      },
      include: {
        definition: true,
        steps: {
          orderBy: { sequence: 'desc' },
          take: 1
        }
      },
      orderBy: { startTime: 'desc' },
      take: 20
    })
    
    const activeJourneysData = activeJourneyInstances.map(journey => {
      const currentStep = journey.steps[0]
      const progress = journey.progressPercentage || 0
      
      // Determine status based on various factors
      let status: 'active' | 'stuck' = 'active'
      const timeSinceLastEvent = Date.now() - journey.lastEventTime.getTime()
      
      if (journey.status === 'stuck') {
        status = 'stuck'
      } else if (timeSinceLastEvent > 2 * 60 * 60 * 1000) { // 2 hours
        status = 'stuck' // Changed from 'at_risk' to 'stuck'
      }
      
      const riskFactors: string[] = []
      if (timeSinceLastEvent > 2 * 60 * 60 * 1000) {
        riskFactors.push(`No activity for ${Math.round(timeSinceLastEvent / (60 * 60 * 1000))} hours`)
      }
      if (journey.riskScore && journey.riskScore > 50) {
        riskFactors.push('High risk score')
      }
      
      return {
        id: journey.id,
        type: journey.definition.name,
        resourceId: journey.resourceId,
        resourceType: journey.resourceType,
        status,
        progress,
        currentStep: currentStep?.stepName || 'Unknown',
        startTime: journey.startTime,
        estimatedCompletion: journey.estimatedCompletionTime,
        riskFactors
      }
    })
    
    // Get stuck journeys
    const stuckJourneys = await prisma.journeyInstance.findMany({
      where: {
        status: 'stuck'
      },
      include: {
        definition: true,
        steps: {
          orderBy: { sequence: 'desc' },
          take: 1
        }
      },
      take: 10
    })
    
    const stuckJourneysData = stuckJourneys.map(journey => {
      const lastStep = journey.steps[0]
      const stuckDuration = Date.now() - journey.lastEventTime.getTime()
      
      // Generate recommendations based on journey type and current step
      let recommendation = 'Review journey status and check for blocking issues'
      
      if (journey.definition.name.includes('Verification')) {
        recommendation = 'Check document upload status and verification requirements'
      } else if (journey.definition.name.includes('Micro-deposit')) {
        recommendation = 'Send reminder to customer to verify micro-deposits'
      } else if (journey.definition.name.includes('Transfer')) {
        recommendation = 'Check transfer status and any failure reasons'
      }
      
      return {
        id: journey.id,
        type: journey.definition.name,
        resourceId: journey.resourceId,
        lastActivity: journey.lastEventTime,
        stuckDuration,
        currentStep: lastStep?.stepName || 'Unknown',
        recommendation
      }
    })
    
    return NextResponse.json({
      summary: {
        activeJourneys,
        completedToday,
        failedToday,
        abandonedToday,
        avgCompletionTime: Number(avgCompletionStats._avg.totalDurationMs || 0),
        successRate: parseFloat(successRate.toFixed(1))
      },
      journeyTypes: journeyTypes.filter(jt => jt.active > 0 || jt.completed > 0),
      activeJourneys: activeJourneysData,
      stuckJourneys: stuckJourneysData
    })
    
  } catch (error) {
    log.error('Failed to get journey analytics', error as Error)
    
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to get journey analytics'
      },
      { status: 500 }
    )
  }
}