import type { UnifiedSearchResult } from "./unified-search"

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
          membershipTimestamp: "2025-01-15T10:30:00Z"
        },
        {
          listId: 1002,
          listName: "Q1 2025 Campaign Recipients",
          listType: "STATIC" as const,
          membershipTimestamp: "2025-01-10T14:15:00Z"
        },
        {
          listId: 1003,
          listName: "Enterprise Accounts",
          listType: "DYNAMIC" as const,
          membershipTimestamp: "2025-01-12T09:45:00Z"
        },
        {
          listId: 1004,
          listName: "Newsletter Subscribers",
          listType: "DYNAMIC" as const,
          membershipTimestamp: "2025-01-08T16:20:00Z"
        },
        {
          listId: 1005,
          listName: "Premium Support Customers",
          listType: "DYNAMIC" as const,
          membershipTimestamp: "2025-01-20T11:15:00Z"
        },
        {
          listId: 1006,
          listName: "Renewal Reminders - Q1",
          listType: "STATIC" as const,
          membershipTimestamp: "2025-01-05T08:30:00Z"
        }
      ],
      claritySessions: [
        {
          id: "clarity_session_001",
          recordingUrl: "https://clarity.microsoft.com/projects/view/abc123/session/def456",
          timestamp: new Date("2025-01-22T15:30:00Z"),
          duration: 180,
          deviceType: "desktop",
          browser: "Chrome 120",
          smartEvents: [
            {
              event: "Login",
              type: "Auto",
              startTime: "00:41"
            },
            {
              event: "Submit form",
              type: "Auto", 
              startTime: "00:41"
            }
          ]
        },
        {
          id: "clarity_session_002",
          recordingUrl: "https://clarity.microsoft.com/projects/view/abc123/session/ghi789",
          timestamp: new Date("2025-01-21T10:15:00Z"),
          duration: 420,
          deviceType: "mobile",
          browser: "Safari 17",
          smartEvents: [
            {
              event: "Page view",
              type: "Auto",
              startTime: "00:05"
            },
            {
              event: "Click button",
              type: "Manual",
              startTime: "01:23"
            },
            {
              event: "Form error",
              type: "Auto",
              startTime: "02:45"
            }
          ]
        }
      ],
    },
  },
  dwolla: {
    success: true,
    duration: 600,
    data: {
      customer: {
        id: "e8b0f3d2-4a89-4c6b-8383-1234567890ab",
        status: "verified",
        type: "business",
        firstName: "John",
        lastName: "Doe",
        email: "john.doe@example.com",
        businessName: "Acme Corporation",
        created: "2024-01-15T10:30:00.000Z",
        address1: "123 Main St",
        address2: "Suite 100",
        city: "Austin",
        state: "TX",
        postalCode: "78701",
        phone: "+1-512-555-0123",
        _links: {
          self: { href: "https://api.dwolla.com/customers/e8b0f3d2-4a89-4c6b-8383-1234567890ab" },
          "funding-sources": {
            href: "https://api.dwolla.com/customers/e8b0f3d2-4a89-4c6b-8383-1234567890ab/funding-sources",
          },
          transfers: {
            href: "https://api.dwolla.com/customers/e8b0f3d2-4a89-4c6b-8383-1234567890ab/transfers",
          },
          notifications: {
            href: "https://api.dwolla.com/customers/e8b0f3d2-4a89-4c6b-8383-1234567890ab/notifications",
          },
        },
      },
      fundingSources: [
        {
          id: "fs_001",
          status: "verified",
          type: "bank",
          bankAccountType: "checking",
          name: "Business Checking - Chase",
          created: "2024-01-16T09:00:00.000Z",
          bankName: "JPMORGAN CHASE BANK",
          accountNumberMasked: "****4567",
          routingNumber: "111000025",
          _links: {
            self: { href: "https://api.dwolla.com/funding-sources/fs_001" },
            customer: {
              href: "https://api.dwolla.com/customers/e8b0f3d2-4a89-4c6b-8383-1234567890ab",
            },
          },
        },
        {
          id: "fs_002",
          status: "verified",
          type: "bank",
          bankAccountType: "savings",
          name: "Business Savings - Chase",
          created: "2024-01-16T09:00:00.000Z",
          bankName: "JPMORGAN CHASE BANK",
          accountNumberMasked: "****7890",
          routingNumber: "111000025",
          _links: {
            self: { href: "https://api.dwolla.com/funding-sources/fs_002" },
            customer: {
              href: "https://api.dwolla.com/customers/e8b0f3d2-4a89-4c6b-8383-1234567890ab",
            },
          },
        },
      ],
      transfers: [
        {
          id: "tr_001",
          status: "processed",
          amount: {
            value: "2625.00",
            currency: "USD",
          },
          created: "2025-01-05T15:30:00.000Z",
          metadata: {
            invoiceNumber: "INV-2025-001",
            description: "January 2025 Benefits Payment",
          },
          correlationId: "acme-2025-01",
          _links: {
            self: { href: "https://api.dwolla.com/transfers/tr_001" },
            source: { href: "https://api.dwolla.com/funding-sources/fs_001" },
            destination: { href: "https://api.dwolla.com/funding-sources/dest_001" },
          },
        },
        {
          id: "tr_002",
          status: "processed",
          amount: {
            value: "2625.00",
            currency: "USD",
          },
          created: "2024-12-05T15:30:00.000Z",
          metadata: {
            invoiceNumber: "INV-2024-012",
            description: "December 2024 Benefits Payment",
          },
          correlationId: "acme-2024-12",
          _links: {
            self: { href: "https://api.dwolla.com/transfers/tr_002" },
            source: { href: "https://api.dwolla.com/funding-sources/fs_001" },
            destination: { href: "https://api.dwolla.com/funding-sources/dest_001" },
          },
        },
        {
          id: "tr_003",
          status: "processed",
          amount: {
            value: "2625.00",
            currency: "USD",
          },
          created: "2024-11-05T15:30:00.000Z",
          metadata: {
            invoiceNumber: "INV-2024-011",
            description: "November 2024 Benefits Payment",
          },
          correlationId: "acme-2024-11",
          _links: {
            self: { href: "https://api.dwolla.com/transfers/tr_003" },
            source: { href: "https://api.dwolla.com/funding-sources/fs_001" },
            destination: { href: "https://api.dwolla.com/funding-sources/dest_001" },
          },
        },
      ],
      notifications: [],
    },
  },
}
