import { useState, useEffect, useCallback } from 'react'
import { Policy } from '@/lib/types/hubspot'
import { mapPolicyStatus } from '@/lib/utils/policy-utils'

interface UsePoliciesResult {
  policies: Policy[]
  isLoading: boolean
  error: string | null
  refetch: () => Promise<void>
}

interface FetchPoliciesParams {
  companyId?: string
  summaryOfBenefitsId?: string
  autoFetch?: boolean
}

export function usePolicies({ 
  companyId, 
  summaryOfBenefitsId, 
  autoFetch = true 
}: FetchPoliciesParams = {}): UsePoliciesResult {
  const [policies, setPolicies] = useState<Policy[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchPolicies = useCallback(async () => {
    if (!companyId && !summaryOfBenefitsId) {
      setError('Either companyId or summaryOfBenefitsId is required')
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      // Build the query parameters
      const params = new URLSearchParams()
      if (companyId) params.append('companyId', companyId)
      if (summaryOfBenefitsId) params.append('sobId', summaryOfBenefitsId)

      const response = await fetch(`/api/hubspot/policies?${params.toString()}`)
      
      if (!response.ok) {
        throw new Error(`Failed to fetch policies: ${response.status} ${response.statusText}`)
      }

      const result = await response.json()

      if (!result.success) {
        throw new Error(result.error || 'Failed to fetch policies')
      }

      // Transform HubSpot data to our Policy interface
      const transformedPolicies: Policy[] = (result.data.policies || []).map((hubspotPolicy: any) => ({
        id: hubspotPolicy.id,
        policyNumber: hubspotPolicy.properties?.policyholder || hubspotPolicy.properties?.policy_id_dont_use_,
        productName: hubspotPolicy.properties?.product_name || 'Unknown Product',
        planName: hubspotPolicy.properties?.plan_name,
        policyHolderName: hubspotPolicy.properties?.first_name && hubspotPolicy.properties?.last_name 
          ? `${hubspotPolicy.properties.first_name} ${hubspotPolicy.properties.last_name}`
          : hubspotPolicy.properties?.policyholder || 'Unknown Policyholder',
        costPerMonth: parseFloat(hubspotPolicy.properties?.cost_per_month || '0'),
        policyStatus: mapPolicyStatus(hubspotPolicy.properties?.policy_status),
        effectiveDate: hubspotPolicy.properties?.policy_effective_date || new Date().toISOString(),
        expirationDate: hubspotPolicy.properties?.policy_termination_date,
        terminationDate: hubspotPolicy.properties?.policy_termination_date,
        coverageLevel: hubspotPolicy.properties?.coverage_level_display || hubspotPolicy.properties?.coverage_level,
        coverageAmount: parseFloat(hubspotPolicy.properties?.coverage_amount || '0') || undefined,
        coverageAmountSpouse: parseFloat(hubspotPolicy.properties?.coverage_amount_spouse || '0') || undefined,
        coverageAmountChildren: parseFloat(hubspotPolicy.properties?.coverage_amount_children || '0') || undefined,
        companyName: hubspotPolicy.properties?.company_name,
        productCode: hubspotPolicy.properties?.product_code,
        renewalDate: hubspotPolicy.properties?.renewal_date,
        notes: hubspotPolicy.properties?.notes,
      }))

      setPolicies(transformedPolicies)
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred'
      setError(errorMessage)
      console.error('Error fetching policies:', err)
    } finally {
      setIsLoading(false)
    }
  }, [companyId, summaryOfBenefitsId])

  // Auto-fetch on mount if enabled and we have required params
  useEffect(() => {
    if (autoFetch && (companyId || summaryOfBenefitsId)) {
      fetchPolicies()
    }
  }, [companyId, summaryOfBenefitsId, autoFetch, fetchPolicies])

  return {
    policies,
    isLoading,
    error,
    refetch: fetchPolicies,
  }
}

 