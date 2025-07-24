import type { SearchTemplate } from "@/lib/types/search"

export const defaultSearchTemplates: SearchTemplate[] = [
  {
    id: "unverified-customers",
    name: "Unverified Customers",
    description: "Find customers with unverified accounts or funding sources",
    category: "verification",
    icon: "shield-alert",
    searchParams: {
      filters: {
        customerStatus: ["unverified"],
        hasUnverifiedFunding: true,
      },
    },
    tags: ["verification", "compliance"],
  },
  {
    id: "failed-transfers",
    name: "Failed Transfers",
    description: "Customers with failed transfer attempts",
    category: "financial",
    icon: "alert-circle",
    searchParams: {
      filters: {
        transferStatus: ["failed"],
        hasFailedTransfers: true,
      },
    },
    tags: ["transfers", "issues"],
  },
  {
    id: "pending-invoices",
    name: "Pending Invoices",
    description: "Customers with outstanding invoices",
    category: "financial",
    icon: "file-text",
    searchParams: {
      filters: {
        hasPendingInvoices: true,
      },
    },
    tags: ["invoices", "billing"],
  },
  {
    id: "high-value-transfers",
    name: "High Value Transfers",
    description: "Transfers over $10,000",
    category: "financial",
    icon: "dollar-sign",
    searchParams: {
      filters: {
        transferAmountRange: {
          min: 10000,
          max: 1000000,
          currency: "USD",
        },
      },
    },
    tags: ["transfers", "high-value"],
  },
  {
    id: "recent-signups",
    name: "Recent Signups",
    description: "Customers created in the last 7 days",
    category: "common",
    icon: "user-plus",
    searchParams: {
      filters: {
        createdDateRange: {
          start: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
          end: new Date().toISOString(),
        },
      },
    },
    tags: ["new", "onboarding"],
  },
  {
    id: "inactive-customers",
    name: "Inactive Customers",
    description: "Customers with no recent activity",
    category: "common",
    icon: "user-x",
    searchParams: {
      filters: {
        customerStatus: ["inactive"],
        modifiedDateRange: {
          start: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString(),
          end: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
        },
      },
    },
    tags: ["inactive", "retention"],
  },
  {
    id: "verification-required",
    name: "Verification Required",
    description: "Customers needing identity or funding verification",
    category: "compliance",
    icon: "user-check",
    searchParams: {
      filters: {
        customerStatus: ["unverified"],
        fundingSourceStatus: ["unverified"],
      },
    },
    tags: ["verification", "kyc"],
  },
  {
    id: "large-benefits",
    name: "Large Benefits",
    description: "Customers with benefits over $5,000",
    category: "financial",
    icon: "trending-up",
    searchParams: {
      filters: {
        benefitAmountRange: {
          min: 5000,
          max: 1000000,
          currency: "USD",
        },
      },
    },
    tags: ["benefits", "high-value"],
  },
  {
    id: "processing-transfers",
    name: "Processing Transfers",
    description: "Transfers currently being processed",
    category: "financial",
    icon: "loader",
    searchParams: {
      filters: {
        transferStatus: ["pending", "processed"],
      },
    },
    tags: ["transfers", "pending"],
  },
  {
    id: "suspended-accounts",
    name: "Suspended Accounts",
    description: "Customers with suspended accounts requiring review",
    category: "compliance",
    icon: "user-x",
    searchParams: {
      filters: {
        customerStatus: ["suspended"],
      },
    },
    tags: ["suspended", "review"],
  },
]

/**
 * Get search templates by category
 */
export function getTemplatesByCategory(category: SearchTemplate["category"]) {
  return defaultSearchTemplates.filter((template) => template.category === category)
}

/**
 * Get search templates by tag
 */
export function getTemplatesByTag(tag: string) {
  return defaultSearchTemplates.filter((template) => template.tags?.includes(tag))
}

/**
 * Get template by ID
 */
export function getTemplateById(id: string) {
  return defaultSearchTemplates.find((template) => template.id === id)
}
