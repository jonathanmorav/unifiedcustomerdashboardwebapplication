import type { SearchResult, AdvancedSearchResult, UnifiedSearchResult } from "@/lib/types/search"
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
  searchTerm: "acme",
  searchType: "auto",
  timestamp: new Date("2024-01-15T10:30:00Z"),
  duration: 245,
  
  pagination: {
    currentPage: 1,
    pageSize: 20,
    totalResults: 25,
    totalPages: 2,
  },
  
  hubspot: {
    success: true,
    data: [mockHubSpotCustomerData],
    duration: 120,
    totalCount: 15,
  },
  
  dwolla: {
    success: true,
    data: [mockDwollaCustomerData],
    duration: 125,
    totalCount: 10,
  },
  
  statistics: {
    totalCustomers: 25,
    activeCustomers: 20,
    totalTransferAmount: 125000,
    failedTransfersCount: 3,
    unverifiedFundingCount: 2,
  },
}

export const mockEmptySearchResult: AdvancedSearchResult = {
  searchTerm: "nonexistent",
  searchType: "auto",
  timestamp: new Date("2024-01-15T10:30:00Z"),
  duration: 89,
  
  pagination: {
    currentPage: 1,
    pageSize: 20,
    totalResults: 0,
    totalPages: 0,
  },
  
  hubspot: {
    success: true,
    data: [],
    duration: 45,
    totalCount: 0,
  },
  
  dwolla: {
    success: true,
    data: [],
    duration: 44,
    totalCount: 0,
  },
  
  statistics: {
    totalCustomers: 0,
    activeCustomers: 0,
    totalTransferAmount: 0,
    failedTransfersCount: 0,
    unverifiedFundingCount: 0,
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

// Unified search result mock for search history client
export const mockUnifiedSearchResult: UnifiedSearchResult = {
  results: {
    results: {
      hubspot: mockSearchResults.filter(r => r.type === "hubspot"),
      dwolla: mockSearchResults.filter(r => r.type === "dwolla"),
    }
  },
  totalResults: 25,
  searchTerm: "acme corporation",
  timestamp: new Date("2024-01-15T10:30:00Z"),
  duration: 245,
  pagination: {
    page: 1,
    pageSize: 20,
    totalPages: 2,
  },
  success: true,
}

export const mockEmptyUnifiedSearchResult: UnifiedSearchResult = {
  results: {
    results: {
      hubspot: [],
      dwolla: [],
    }
  },
  totalResults: 0,
  searchTerm: "nonexistent",
  timestamp: new Date("2024-01-15T10:30:00Z"),
  duration: 89,
  pagination: {
    page: 1,
    pageSize: 20,
    totalPages: 0,
  },
  success: true,
}
