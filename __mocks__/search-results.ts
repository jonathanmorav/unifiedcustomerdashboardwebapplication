import type { AdvancedSearchResult } from "@/lib/types/search"
import { mockHubSpotCustomerData } from "./hubspot-responses"
import { mockDwollaCustomerData } from "./dwolla-responses"

export const mockAdvancedSearchResult: AdvancedSearchResult = {
  searchTerm: "acme",
  searchType: "auto",
  timestamp: new Date(),
  duration: 245,
  
  pagination: {
    currentPage: 1,
    pageSize: 10,
    totalResults: 3,
    totalPages: 1,
  },
  
  hubspot: {
    success: true,
    data: [mockHubSpotCustomerData],
    duration: 120,
    totalCount: 2,
  },
  
  dwolla: {
    success: true,
    data: [mockDwollaCustomerData],
    duration: 125,
    totalCount: 1,
  },
  
  statistics: {
    totalCustomers: 3,
    activeCustomers: 3,
    totalTransferAmount: 9850,
    failedTransfersCount: 1,
    unverifiedFundingCount: 0,
  },
}

export const mockEmptySearchResult: AdvancedSearchResult = {
  searchTerm: "nonexistent",
  searchType: "auto",
  timestamp: new Date(),
  duration: 50,
  
  hubspot: {
    success: true,
    data: [],
    duration: 25,
    totalCount: 0,
  },
  
  dwolla: {
    success: true,
    data: [],
    duration: 25,
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
