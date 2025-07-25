import type { DwollaCustomerData, DwollaTransfer } from "@/lib/types/dwolla"

export const mockDwollaCustomer = {
  id: "cust_12345",
  firstName: "John",
  lastName: "Doe",
  email: "john.doe@acme.com",
  type: "business",
  status: "verified",
  created: "2024-01-15T10:30:00Z",
  businessName: "Acme Corporation",
  businessType: "corporation",
  businessClassification: "technology",
  ein: "12-3456789",
  doingBusinessAs: "Acme Corp",
  website: "https://acme.com",
  address1: "123 Main St",
  address2: "Suite 100",
  city: "San Francisco",
  state: "CA",
  postalCode: "94105",
  controller: {
    firstName: "John",
    lastName: "Doe",
    title: "CEO",
    dateOfBirth: "1980-01-15",
    ssn: "****6789",
    address: {
      address1: "123 Main St",
      city: "San Francisco",
      stateProvinceRegion: "CA",
      postalCode: "94105",
      country: "US",
    },
  },
}

export const mockDwollaFundingSource = {
  id: "fund_12345",
  status: "verified",
  type: "bank",
  bankAccountType: "checking",
  name: "Business Checking",
  created: "2024-01-20T09:00:00Z",
  balance: {
    value: "25000.00",
    currency: "USD",
  },
  removed: false,
  channels: ["ach"],
  bankName: "Wells Fargo",
  fingerprint: "abc123def456",
}

export const mockDwollaTransfer: DwollaTransfer = {
  id: "transfer_001",
  status: "processed",
  amount: {
    value: "5150.00",
    currency: "USD",
  },
  created: "2024-12-15T10:30:00Z",
  clearing: {
    source: "standard",
  },
  metadata: {
    invoice: "INV-2024-001",
    type: "premium_collection",
  },
  correlationId: "premium-collection-001",
  individualAchId: "WEB123456789",
}

export const mockDwollaTransfers: DwollaTransfer[] = [
  mockDwollaTransfer,
  {
    ...mockDwollaTransfer,
    id: "transfer_002",
    status: "pending",
    amount: {
      value: "3200.00",
      currency: "USD",
    },
    created: "2024-12-20T14:00:00Z",
    metadata: {
      invoice: "INV-2024-002",
      type: "claim_reimbursement",
    },
  },
  {
    ...mockDwollaTransfer,
    id: "transfer_003",
    status: "failed",
    amount: {
      value: "1500.00",
      currency: "USD",
    },
    created: "2024-12-18T11:00:00Z",
    metadata: {
      invoice: "INV-2024-003",
      type: "refund",
    },
  },
]

export const mockDwollaCustomerData: DwollaCustomerData = {
  customer: mockDwollaCustomer,
  fundingSources: [mockDwollaFundingSource],
  transfers: mockDwollaTransfers,
}

export const mockDwollaError = {
  code: "ValidationError",
  message: "Invalid customer ID",
  _embedded: {
    errors: [
      {
        code: "InvalidFormat",
        message: "Customer ID must be a valid UUID",
        path: "/id",
      },
    ],
  },
}

export const mockDwollaSearchResults = [
  mockDwollaCustomerData,
  {
    ...mockDwollaCustomerData,
    customer: {
      ...mockDwollaCustomer,
      id: "cust_67890",
      businessName: "Tech Innovations Inc",
      email: "contact@techinnovations.com",
    },
  },
]
