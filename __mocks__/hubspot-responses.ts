import type { HubSpotCustomerData } from "@/lib/types/hubspot"

export const mockHubSpotCompany = {
  id: "12345",
  properties: {
    name: "Acme Corporation",
    domain: "acme.com",
    industry: "Technology",
    city: "San Francisco",
    state: "California",
    country: "United States",
    phone: "(555) 123-4567",
    lifecyclestage: "customer",
    hs_object_id: "12345",
    createdate: "2024-01-15T10:30:00Z",
    hs_lastmodifieddate: "2024-12-20T14:45:00Z",
  },
  createdAt: "2024-01-15T10:30:00Z",
  updatedAt: "2024-12-20T14:45:00Z",
  archived: false,
}

export const mockSummaryOfBenefits = {
  id: "sob-001",
  properties: {
    name: "Q1 2024 Benefits",
    amount_to_draft: 5000,
    fee_amount: 150,
    status: "active",
    effective_date: "2024-01-01",
    pdf_document_url: "https://example.com/sob/q1-2024.pdf",
    hs_object_id: "sob-001",
    createdate: "2024-01-01T00:00:00Z",
    hs_lastmodifieddate: "2024-01-01T00:00:00Z",
  },
  createdAt: "2024-01-01T00:00:00Z",
  updatedAt: "2024-01-01T00:00:00Z",
  archived: false,
}

export const mockPolicies = [
  {
    id: "pol-001",
    properties: {
      policy_number: "POL-2024-001",
      policy_holder_name: "John Doe",
      coverage_type: "Health",
      premium_amount: 1200,
      effective_date: "2024-01-01",
      status: "active",
    },
    createdAt: "2024-01-01T00:00:00Z",
    updatedAt: "2024-01-01T00:00:00Z",
    archived: false,
  },
  {
    id: "pol-002",
    properties: {
      policy_number: "POL-2024-002",
      policy_holder_name: "John Doe",
      coverage_type: "Dental",
      premium_amount: 300,
      effective_date: "2024-01-01",
      status: "active",
    },
    createdAt: "2024-01-01T00:00:00Z",
    updatedAt: "2024-01-01T00:00:00Z",
    archived: false,
  },
]

export const mockMonthlyInvoice = {
  id: "inv-001",
  properties: {
    invoice_number: "INV-2024-001",
    invoice_date: "2024-01-01",
    total_amount: 5150,
    due_date: "2024-02-01",
    status: "paid",
    payment_date: "2024-01-28",
  },
  createdAt: "2024-01-01T00:00:00Z",
  updatedAt: "2024-01-01T00:00:00Z",
  archived: false,
}

export const mockHubSpotCustomerData: HubSpotCustomerData = {
  company: mockHubSpotCompany,
  summaryOfBenefits: [mockSummaryOfBenefits],
  policies: mockPolicies,
  monthlyInvoices: [mockMonthlyInvoice],
}

export const mockHubSpotError = {
  status: "error",
  message: "Unable to fetch company data",
  correlationId: "hub-error-123",
  category: "VALIDATION_ERROR",
}

export const mockHubSpotSearchResults = [
  mockHubSpotCustomerData,
  {
    ...mockHubSpotCustomerData,
    company: {
      ...mockHubSpotCompany,
      id: "67890",
      properties: {
        ...mockHubSpotCompany.properties,
        name: "Tech Innovations Inc",
        domain: "techinnovations.com",
      },
    },
  },
]
