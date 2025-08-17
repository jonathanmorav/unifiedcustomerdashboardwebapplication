import { prisma } from "@/lib/db"
import { logger } from "@/lib/logger"

interface CachedCompanyData {
  company: any
  summaryOfBenefits: any[]
  policies: any[]
}

interface CachedSOBData {
  sobId: string
  companyName: string
  amountToDraft: number
  feeAmount: number
  policies: any[]
  coverageMonth: string
}

interface CachedPolicyData {
  policyId: string
  policyHolderName: string
  productName: string
  planName?: string
  monthlyCost: number
  coverageLevel: string
  carrier?: string
}

export class DatabaseCache {
  private defaultTTL = 24 * 60 * 60 * 1000 // 24 hours default TTL

  constructor(private ttl: number = 24 * 60 * 60 * 1000) {
    this.defaultTTL = ttl
  }

  // Company cache methods
  async getCompany(dwollaCustomerId: string): Promise<CachedCompanyData | null> {
    try {
      const cached = await prisma.hubSpotCompanyCache.findFirst({
        where: {
          dwollaCustomerId,
          expiresAt: { gt: new Date() }
        }
      })

      if (!cached) return null

      // Get associated SOBs and policies
      const sobs = await prisma.hubSpotSOBCache.findMany({
        where: {
          companyId: cached.companyId,
          expiresAt: { gt: new Date() }
        },
        orderBy: { coverageMonth: 'desc' }
      })

      const policies = await prisma.hubSpotPolicyCache.findMany({
        where: {
          companyId: cached.companyId,
          expiresAt: { gt: new Date() }
        }
      })

      return {
        company: cached.data,
        summaryOfBenefits: sobs.map(s => s.data),
        policies: policies.map(p => p.data)
      }
    } catch (error) {
      logger.error("Error reading company from cache", { error, dwollaCustomerId })
      return null
    }
  }

  async setCompany(
    companyData: CachedCompanyData,
    dwollaCustomerId?: string,
    ttl?: number
  ): Promise<void> {
    try {
      const expiresAt = new Date(Date.now() + (ttl || this.defaultTTL))
      const now = new Date()

      // Extract company info
      const company = companyData.company
      const companyId = company.id || company.companyId
      const companyName = company.properties?.name || company.name || "Unknown"

      // Save company
      await prisma.hubSpotCompanyCache.upsert({
        where: { companyId },
        create: {
          companyId,
          dwollaCustomerId,
          companyName,
          data: company as any,
          lastFetchedAt: now,
          expiresAt
        },
        update: {
          dwollaCustomerId,
          companyName,
          data: company as any,
          lastFetchedAt: now,
          expiresAt
        }
      })

      // Save SOBs
      for (const sob of companyData.summaryOfBenefits || []) {
        const sobId = sob.id || sob.sobId
        const coverageMonth = sob.properties?.coverage_month || 
                             sob.coverageMonth || 
                             new Date().toISOString().slice(0, 7)
        
        await prisma.hubSpotSOBCache.upsert({
          where: { sobId },
          create: {
            sobId,
            companyId,
            coverageMonth,
            amountToDraft: sob.properties?.amount_to_draft || sob.amountToDraft || 0,
            feeAmount: sob.properties?.fee_amount || sob.feeAmount || 0,
            data: sob as any,
            lastFetchedAt: now,
            expiresAt
          },
          update: {
            companyId,
            coverageMonth,
            amountToDraft: sob.properties?.amount_to_draft || sob.amountToDraft || 0,
            feeAmount: sob.properties?.fee_amount || sob.feeAmount || 0,
            data: sob as any,
            lastFetchedAt: now,
            expiresAt
          }
        })
      }

      // Save policies
      for (const policy of companyData.policies || []) {
        const policyId = policy.id || policy.policyId
        const props = policy.properties || policy
        const sobId = companyData.summaryOfBenefits[0]?.id || "unknown"
        
        await prisma.hubSpotPolicyCache.upsert({
          where: { policyId },
          create: {
            policyId,
            sobId,
            companyId,
            policyHolderName: props.policyholder || 
              `${props.first_name || ""} ${props.last_name || ""}`.trim() || 
              "Unknown",
            productName: props.product_name || "Unknown Product",
            monthlyCost: props.cost_per_month || props.monthlyCost || 0,
            coverageLevel: props.coverage_level_display || 
                          props.coverage_level || 
                          props.coverageLevel || 
                          "Unknown",
            data: policy as any,
            lastFetchedAt: now,
            expiresAt
          },
          update: {
            sobId,
            companyId,
            policyHolderName: props.policyholder || 
              `${props.first_name || ""} ${props.last_name || ""}`.trim() || 
              "Unknown",
            productName: props.product_name || "Unknown Product",
            monthlyCost: props.cost_per_month || props.monthlyCost || 0,
            coverageLevel: props.coverage_level_display || 
                          props.coverage_level || 
                          props.coverageLevel || 
                          "Unknown",
            data: policy as any,
            lastFetchedAt: now,
            expiresAt
          }
        })
      }

      logger.info("Cached company data to database", { 
        companyId, 
        companyName,
        sobCount: companyData.summaryOfBenefits?.length || 0,
        policyCount: companyData.policies?.length || 0
      })
    } catch (error) {
      logger.error("Error writing company to cache", { error })
    }
  }

  // SOB cache methods
  async getSOB(transferId: string): Promise<CachedSOBData | null> {
    try {
      // First try to find by transfer's customer ID
      const transfer = await prisma.aCHTransaction.findUnique({
        where: { dwollaId: transferId },
        select: { customerId: true, companyName: true, customerName: true }
      })

      if (!transfer?.customerId) return null

      // Get company from cache
      const company = await prisma.hubSpotCompanyCache.findFirst({
        where: {
          dwollaCustomerId: transfer.customerId,
          expiresAt: { gt: new Date() }
        }
      })

      if (!company) return null

      // Get latest SOB
      const sob = await prisma.hubSpotSOBCache.findFirst({
        where: {
          companyId: company.companyId,
          expiresAt: { gt: new Date() }
        },
        orderBy: { coverageMonth: 'desc' }
      })

      if (!sob) return null

      // Get associated policies
      const policies = await prisma.hubSpotPolicyCache.findMany({
        where: {
          sobId: sob.sobId,
          expiresAt: { gt: new Date() }
        }
      })

      // Get carrier mappings for products
      const policiesWithCarriers = await Promise.all(
        policies.map(async (policy) => {
          const mapping = await prisma.carrierMapping.findUnique({
            where: { productName: policy.productName }
          })
          
          const policyData = policy.data as any
          return {
            policyId: `${policy.policyHolderName} - ${policy.productName}`,
            policyHolderName: policy.policyHolderName,
            productName: policy.productName,
            planName: policyData.properties?.plan_name,
            monthlyCost: parseFloat(policy.monthlyCost.toString()),
            coverageLevel: policy.coverageLevel,
            carrier: mapping?.carrierName || "Unmapped"
          }
        })
      )

      return {
        sobId: sob.sobId,
        companyName: company.companyName,
        amountToDraft: parseFloat(sob.amountToDraft.toString()),
        feeAmount: parseFloat(sob.feeAmount.toString()),
        policies: policiesWithCarriers,
        coverageMonth: sob.coverageMonth
      }
    } catch (error) {
      logger.error("Error reading SOB from cache", { error, transferId })
      return null
    }
  }

  // Clear expired cache entries
  async clearExpired(): Promise<number> {
    try {
      const now = new Date()
      
      const [companies, sobs, policies] = await Promise.all([
        prisma.hubSpotCompanyCache.deleteMany({
          where: { expiresAt: { lt: now } }
        }),
        prisma.hubSpotSOBCache.deleteMany({
          where: { expiresAt: { lt: now } }
        }),
        prisma.hubSpotPolicyCache.deleteMany({
          where: { expiresAt: { lt: now } }
        })
      ])

      const total = companies.count + sobs.count + policies.count
      
      if (total > 0) {
        logger.info("Cleared expired cache entries", {
          companies: companies.count,
          sobs: sobs.count,
          policies: policies.count,
          total
        })
      }

      return total
    } catch (error) {
      logger.error("Error clearing expired cache", { error })
      return 0
    }
  }

  // Get cache statistics
  async getStats() {
    try {
      const now = new Date()
      
      const [
        totalCompanies,
        activeCompanies,
        totalSobs,
        activeSobs,
        totalPolicies,
        activePolicies
      ] = await Promise.all([
        prisma.hubSpotCompanyCache.count(),
        prisma.hubSpotCompanyCache.count({ where: { expiresAt: { gt: now } } }),
        prisma.hubSpotSOBCache.count(),
        prisma.hubSpotSOBCache.count({ where: { expiresAt: { gt: now } } }),
        prisma.hubSpotPolicyCache.count(),
        prisma.hubSpotPolicyCache.count({ where: { expiresAt: { gt: now } } })
      ])

      return {
        companies: { total: totalCompanies, active: activeCompanies },
        sobs: { total: totalSobs, active: activeSobs },
        policies: { total: totalPolicies, active: activePolicies },
        total: {
          total: totalCompanies + totalSobs + totalPolicies,
          active: activeCompanies + activeSobs + activePolicies
        }
      }
    } catch (error) {
      logger.error("Error getting cache stats", { error })
      return null
    }
  }

  // Search company by name
  async searchCompanyByName(companyName: string): Promise<CachedCompanyData | null> {
    try {
      const cached = await prisma.hubSpotCompanyCache.findFirst({
        where: {
          companyName: {
            contains: companyName,
            mode: 'insensitive'
          },
          expiresAt: { gt: new Date() }
        }
      })

      if (!cached) return null

      // Get associated SOBs and policies
      const sobs = await prisma.hubSpotSOBCache.findMany({
        where: {
          companyId: cached.companyId,
          expiresAt: { gt: new Date() }
        },
        orderBy: { coverageMonth: 'desc' }
      })

      const policies = await prisma.hubSpotPolicyCache.findMany({
        where: {
          companyId: cached.companyId,
          expiresAt: { gt: new Date() }
        }
      })

      return {
        company: cached.data,
        summaryOfBenefits: sobs.map(s => s.data),
        policies: policies.map(p => p.data)
      }
    } catch (error) {
      logger.error("Error searching company by name", { error, companyName })
      return null
    }
  }
}

// Export singleton instance
export const databaseCache = new DatabaseCache()