import type { UnifiedSearchResult } from "./unified-search"
import type { FormattedDwollaCustomer, FormattedTransfer } from "@/lib/types/dwolla"

export const mockSearchResult: UnifiedSearchResult = {
  searchTerm: "john.doe@example.com",
  searchType: "email",
  timestamp: new Date(),
  duration: 1250,
  hubspot: {
    success: true,
    duration: 650,
    data: {
      company: {
        id: "12345",
        properties: {
          name: "Acme Corporation",
          domain: "acme.com",
          hs_object_id: "12345",
          createdate: "2024-01-15T10:30:00Z",
          hs_lastmodifieddate: "2025-01-18T14:45:00Z",
          email___owner: "support@acme.com",
          dwolla_customer_id: "e8b0f3d2-4a89-4c6b-8383-1234567890ab",
        },
        createdAt: "2024-01-15T10:30:00Z",
        updatedAt: "2025-01-18T14:45:00Z",
        archived: false,
      },
      summaryOfBenefits: [
        {
          id: "sob_001",
          properties: {
            hs_object_id: "sob_001",
            amount_to_draft: 2500.0,
            fee_amount: 125.0,
            pdf_document_url: "https://example.com/sob/2025-01.pdf",
            createdate: "2025-01-01T00:00:00Z",
            hs_lastmodifieddate: "2025-01-15T12:00:00Z",
          },
          createdAt: "2025-01-01T00:00:00Z",
          updatedAt: "2025-01-15T12:00:00Z",
          archived: false,
        },
        {
          id: "sob_002",
          properties: {
            hs_object_id: "sob_002",
            amount_to_draft: 2500.0,
            fee_amount: 125.0,
            pdf_document_url: "https://example.com/sob/2024-12.pdf",
            createdate: "2024-12-01T00:00:00Z",
            hs_lastmodifieddate: "2024-12-15T12:00:00Z",
          },
          createdAt: "2024-12-01T00:00:00Z",
          updatedAt: "2024-12-15T12:00:00Z",
          archived: false,
        },
      ],
      policies: [
        {
          id: "pol_001",
          properties: {
            policy_number: "POL-2025-001",
            policy_holder_name: "John Doe",
            coverage_type: "Health Insurance",
            premium_amount: 450.0,
            effective_date: "2025-01-01",
            expiration_date: "2025-12-31",
            status: "active",
          },
          createdAt: "2024-12-15T10:00:00Z",
          updatedAt: "2025-01-01T00:00:00Z",
          archived: false,
        },
        {
          id: "pol_002",
          properties: {
            policy_number: "POL-2025-002",
            policy_holder_name: "Jane Doe",
            coverage_type: "Dental Insurance",
            premium_amount: 150.0,
            effective_date: "2025-01-01",
            expiration_date: "2025-12-31",
            status: "active",
          },
          createdAt: "2024-12-15T10:00:00Z",
          updatedAt: "2025-01-01T00:00:00Z",
          archived: false,
        },
        {
          id: "pol_003",
          properties: {
            policy_number: "POL-2025-003",
            policy_holder_name: "John Doe Jr",
            coverage_type: "Vision Insurance",
            premium_amount: 75.0,
            effective_date: "2025-01-01",
            expiration_date: "2025-12-31",
            status: "active",
          },
          createdAt: "2024-12-15T10:00:00Z",
          updatedAt: "2025-01-01T00:00:00Z",
          archived: false,
        },
      ],
      monthlyInvoices: [
        {
          id: "inv_001",
          properties: {
            invoice_number: "INV-2025-001",
            invoice_date: "2025-01-01",
            total_amount: 2625.0,
            status: "paid",
          },
          createdAt: "2025-01-01T00:00:00Z",
          updatedAt: "2025-01-05T10:00:00Z",
          archived: false,
        },
        {
          id: "inv_002",
          properties: {
            invoice_number: "INV-2024-012",
            invoice_date: "2024-12-01",
            total_amount: 2625.0,
            status: "paid",
          },
          createdAt: "2024-12-01T00:00:00Z",
          updatedAt: "2024-12-05T10:00:00Z",
          archived: false,
        },
      ],
      activeLists: [
        {
          listId: 1001,
          listName: "High-Value Customers",
          listType: "DYNAMIC" as const,
          membershipTimestamp: "2025-01-15T10:30:00Z",
        },
        {
          listId: 1002,
          listName: "Q1 2025 Campaign Recipients",
          listType: "STATIC" as const,
          membershipTimestamp: "2025-01-10T14:15:00Z",
        },
        {
          listId: 1003,
          listName: "Enterprise Accounts",
          listType: "DYNAMIC" as const,
          membershipTimestamp: "2025-01-12T09:45:00Z",
        },
        {
          listId: 1004,
          listName: "Newsletter Subscribers",
          listType: "DYNAMIC" as const,
          membershipTimestamp: "2025-01-08T16:20:00Z",
        },
        {
          listId: 1005,
          listName: "Premium Support Customers",
          listType: "DYNAMIC" as const,
          membershipTimestamp: "2025-01-20T11:15:00Z",
        },
        {
          listId: 1006,
          listName: "Renewal Reminders - Q1",
          listType: "STATIC" as const,
          membershipTimestamp: "2025-01-05T08:30:00Z",
        },
      ],

    },
  },
  dwolla: {
    success: true,
    duration: 600,
    data: {
      customer: {
        id: "e8b0f3d2-4a89-4c6b-8383-1234567890ab",
        type: "business",
        name: "John Doe",
        email: "john.doe@example.com",
        businessName: "Acme Corporation",
        created: "2024-01-15T10:30:00.000Z"
      },
      fundingSources: [
        {
          id: "fs_001",
          type: "bank",
          bankAccountType: "checking",
          name: "Business Checking - Chase",
          bankName: "JPMORGAN CHASE BANK",
          accountNumberMasked: "****4567",
          status: "verified" as const,
          verified: true,
        },
        {
          id: "fs_002",
          type: "bank",
          bankAccountType: "savings",
          name: "Business Savings - Chase",
          bankName: "JPMORGAN CHASE BANK",
          accountNumberMasked: "****7890",
          status: "verified" as const,
          verified: true,
        },
      ],
      transfers: [
        {
          id: "tr_001",
          status: "processed",
          amount: "2625.00",
          currency: "USD",
          created: "2025-01-05T15:30:00.000Z",
          correlationId: "acme-2025-01",
          sourceId: "fs_001",
          destinationId: "dest_001"
        },
        {
          id: "tr_002",
          status: "processed",
          amount: "2625.00",
          currency: "USD",
          created: "2024-12-05T15:30:00.000Z",
          correlationId: "acme-2024-12",
          sourceId: "fs_001",
          destinationId: "dest_001"
        },
        {
          id: "tr_003",
          status: "processed",
          amount: "2625.00",
          currency: "USD",
          created: "2024-11-05T15:30:00.000Z",
          correlationId: "acme-2024-11",
          sourceId: "fs_001",
          destinationId: "dest_001"
        }
      ],
      notifications: [
        {
          id: "notif_001",
          message: "Transfer processed successfully",
          type: "transfer_completed",
          created: "2025-01-05T16:00:00.000Z",
        },
        {
          id: "notif_002", 
          message: "New funding source verified",
          type: "funding_source_verified",
          created: "2025-01-04T14:20:00.000Z",
        },
        {
          id: "notif_003",
          message: "Customer information updated",
          type: "customer_updated",
          created: "2025-01-03T09:15:00.000Z",
        },
      ],
      notificationCount: 2
    },
  },
}
