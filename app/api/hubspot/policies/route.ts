import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { HubSpotClient } from '@/lib/api/hubspot/client'
import { metrics } from '@/lib/monitoring/metrics'
import { HubSpotPolicyObject, HubSpotPolicyProperties } from '@/lib/types/hubspot'
import { log } from '@/lib/logger'
import { v4 as uuidv4 } from 'uuid'

export async function GET(request: NextRequest) {
  const startTime = Date.now()
  const correlationId = uuidv4()
  
  try {
    // Check authentication
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { 
          status: 401,
          headers: { 'X-Correlation-ID': correlationId }
        }
      )
    }

    // Get query parameters
    const searchParams = request.nextUrl.searchParams
    const companyId = searchParams.get('companyId')
    const sobId = searchParams.get('sobId')

    if (!companyId && !sobId) {
      return NextResponse.json(
        { success: false, error: 'Either companyId or sobId is required' },
        { 
          status: 400,
          headers: { 'X-Correlation-ID': correlationId }
        }
      )
    }

    const hubspotClient = new HubSpotClient()
    let policies: HubSpotPolicyObject[] = []

    try {
      if (sobId) {
        // Fetch policies associated with a specific Summary of Benefits
        const associations = await hubspotClient.getAssociations(
          "2-45680577", // Summary of Benefits object type
          sobId,
          "2-45586773"  // Policies object type
        )

        if (associations && associations.results && associations.results.length > 0) {
          const policyIds = associations.results.map((assoc: { id: string; type: string }) => assoc.id.toString())
          
          // Batch fetch policy details
          const policyObjects = await hubspotClient.batchReadObjects<HubSpotPolicyProperties>(
            "2-45586773",
            policyIds,
            [
              'policyholder',
              'product_name', 
              'plan_name',
              'first_name',
              'last_name',
              'cost_per_month',
              'policy_status',
              'policy_effective_date',
              'policy_termination_date',
              'coverage_level',
              'coverage_level_display',
              'coverage_amount',
              'coverage_amount_spouse',
              'coverage_amount_children',
              'company_name',
              'product_code',
              'renewal_date',
              'notes'
            ]
          )

          policies = policyObjects.results || []
        }
      } else if (companyId) {
        // For company-based lookup, we'd need to:
        // 1. Find Summary of Benefits for the company
        // 2. Get policies from those SOBs
        // This is a more complex query, implementing basic version for now
        
        const sobResults = await hubspotClient.searchObjects(
          "2-45680577",
          {
            filterGroups: [{
              filters: [{
                propertyName: "company_name_recipient",
                operator: "EQ",
                value: companyId
              }]
            }],
            properties: ["hs_object_id"],
            limit: 10
          }
        )

        // For each SOB, get associated policies with improved error handling
        for (const sob of sobResults.results || []) {
          try {
            log.info(`Fetching policy associations for SOB`, {
              companyId,
              sobId: sob.id,
              operation: "hubspot_get_policy_associations",
            })

            const sobAssociations = await hubspotClient.getAssociations(
              "2-45680577",
              sob.id,
              "2-45586773"
            )

            log.info(`Policy associations retrieved for SOB`, {
              companyId,
              sobId: sob.id,
              associationsCount: sobAssociations.results.length,
              associationIds: sobAssociations.results.map((a) => a.id),
              operation: "hubspot_get_policy_associations_success",
            })

            if (!sobAssociations.results.length) {
              log.info(`No policy associations found for SOB`, {
                companyId,
                sobId: sob.id,
                operation: "hubspot_get_policy_no_associations",
              })
              continue
            }

            const policyIds = sobAssociations.results.map((assoc: { id: string; type: string }) => assoc.id)
            
            log.info(`Starting batch read of policy objects`, {
              companyId,
              sobId: sob.id,
              policyIds,
              policyCount: policyIds.length,
              operation: "hubspot_get_policy_batch_read_start",
            })

            const policyObjects = await hubspotClient.batchReadObjects<HubSpotPolicyProperties>(
              "2-45586773",
              policyIds,
              [
                'policyholder',
                'product_name', 
                'plan_name',
                'first_name',
                'last_name',
                'cost_per_month',
                'policy_status',
                'policy_effective_date',
                'policy_termination_date',
                'coverage_level',
                'coverage_level_display',
                'coverage_amount',
                'coverage_amount_spouse',
                'coverage_amount_children',
                'company_name',
                'product_code',
                'renewal_date',
                'notes'
              ]
            )

            log.info(`Policy batch read completed for SOB`, {
              companyId,
              sobId: sob.id,
              requestedCount: policyIds.length,
              retrievedCount: policyObjects.results.length,
              operation: "hubspot_get_policy_batch_read_success",
            })

            policies.push(...(policyObjects.results || []))
          } catch (error) {
            log.error(`Error fetching policies for SOB`, error as Error, {
              companyId,
              sobId: sob.id,
              operation: "hubspot_get_policy_error",
            })
            // Continue with other SOBs even if one fails
            continue
          }
        }
      }

      // Record metrics
      const duration = Date.now() - startTime
      metrics.recordApiResponseTime("hubspot_policies", duration)
      metrics.incrementCounter("hubspot_policies_requests_total", {
        status: "success",
        method: "GET",
        query_type: sobId ? "sob" : "company"
      })

      return NextResponse.json(
        {
          success: true,
          data: {
            policies,
            count: policies.length,
            queriedBy: sobId ? 'summaryOfBenefits' : 'company',
            queryValue: sobId || companyId
          }
        },
        {
          headers: { 'X-Correlation-ID': correlationId }
        }
      )

    } catch (hubspotError) {
      console.error('HubSpot API error:', hubspotError)
      
      metrics.incrementCounter("hubspot_policies_requests_total", {
        status: "error",
        method: "GET",
        error_type: "hubspot_api"
      })

      return NextResponse.json(
        { 
          success: false, 
          error: 'Failed to fetch policies from HubSpot',
          details: hubspotError instanceof Error ? hubspotError.message : 'Unknown HubSpot error'
        },
        { 
          status: 500,
          headers: { 'X-Correlation-ID': correlationId }
        }
      )
    }

  } catch (error) {
    console.error('Policies API error:', error)
    
    metrics.incrementCounter("hubspot_policies_requests_total", {
      status: "error", 
      method: "GET",
      error_type: "internal"
    })

    return NextResponse.json(
      { 
        success: false, 
        error: 'Internal server error',
        correlationId
      },
      { 
        status: 500,
        headers: { 'X-Correlation-ID': correlationId }
      }
    )
  }
} 