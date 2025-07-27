import { Policy } from '@/lib/types/hubspot'

/**
 * Maps HubSpot policy status strings to our standardized policy status enum.
 * Uses exact matches and word boundary checks to avoid false positives.
 */
export function mapPolicyStatus(hubspotStatus: string | undefined): Policy['policyStatus'] {
  if (!hubspotStatus) return 'pending'
  
  const status = hubspotStatus.toLowerCase().trim()
  
  // Use exact matches first, then word boundary checks to avoid false positives
  if (status === 'active' || /\bactive\b/.test(status)) return 'active'
  if (status === 'pending' || status === 'payment-pending' || /\bpending\b/.test(status) || /\bpayment\b/.test(status)) return 'payment-pending'
  if (status === 'terminated' || /\bterminated\b/.test(status)) return 'terminated'
  if (status === 'cancelled' || status === 'canceled' || /\bcancelled?\b/.test(status)) return 'cancelled'
  
  return 'pending'
} 