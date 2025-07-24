import type { SearchResult, AdvancedSearchResult } from "@/lib/types/search"
import { mockHubSpotCustomerData } from "./hubspot-responses"
import { mockDwollaCustomerData } from "./dwolla-responses"

export const mockHubSpotSearchResult: SearchResult = {
  id: "hubspot-12345",
  type: "hubspot",
  title: "Acme Corporation",
  subtitle: "Technology • California",
  description: "Active customer since Jan 2024",
  metadata: {
    companyId: "12345",
    email: "contact@acme.com",
    status: "customer",
    lastModified: "2024-12-20T14:45:00Z",
  },
  data: mockHubSpotCustomerData,
  score: 0.95,
}

export const mockDwollaSearchResult: SearchResult = {
  id: "dwolla-cust_12345",
  type: "dwolla",
  title: "Acme Corporation",
  subtitle: "Verified Business Account",
  description: "john.doe@acme.com • Active transfers",
  metadata: {
    customerId: "cust_12345",
    email: "john.doe@acme.com",
    status: "verified",
    lastTransfer: "2024-12-15T10:30:00Z",
  },
  data: mockDwollaCustomerData,
  score: 0.92,
}

export const mockSearchResults: SearchResult[] = [
  mockHubSpotSearchResult,
  mockDwollaSearchResult,
  {
    ...mockHubSpotSearchResult,
    id: "hubspot-67890",
    title: "Tech Innovations Inc",
    subtitle: "Technology • New York",
    score: 0.88,
  },
]

export const mockAdvancedSearchResult: AdvancedSearchResult = {
  results: mockSearchResults,
  totalCount: 25,
  filteredCount: 3,
  facets: {
    type: [
      { value: "hubspot", count: 15 },
      { value: "dwolla", count: 10 },
    ],
    status: [
      { value: "active", count: 20 },
      { value: "pending", count: 3 },
      { value: "inactive", count: 2 },
    ],
  },
  query: {
    searchTerm: "acme",
    filters: {
      type: ["hubspot", "dwolla"],
      status: ["active"],
    },
    sort: {
      field: "score",
      direction: "desc",
    },
    pagination: {
      page: 1,
      limit: 20,
    },
  },
  timing: {
    total: 125,
    hubspot: 80,
    dwolla: 45,
  },
}

export const mockEmptySearchResult: AdvancedSearchResult = {
  results: [],
  totalCount: 0,
  filteredCount: 0,
  facets: {
    type: [],
    status: [],
  },
  query: {
    searchTerm: "nonexistent",
    pagination: {
      page: 1,
      limit: 20,
    },
  },
  timing: {
    total: 50,
  },
}

export const mockSearchHistory = [
  "acme corporation",
  "john.doe@acme.com",
  "cust_12345",
  "invoice 2024",
  "pending transfers",
]

export const mockSearchSuggestions = [
  "acme",
  "acme corporation",
  "acme corp benefits",
  "acme invoices",
  "acme policies",
]
