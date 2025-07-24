"use client"

import { useState, useEffect } from "react"
import { Header } from "./header"
import { SearchSection } from "./search-section"
import { DataPanels } from "./data-panels"
import { RecentSearches } from "./recent-searches"
import { ListAnalyticsDashboard } from "@/components/lists/list-analytics-dashboard"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs"
import { useSearchContext } from "@/contexts/search-context"

// Mock data for demonstration - matches HubSpot result panel structure
const mockData = {
  hubspot: {
    company: {
      id: "CMP-12345",
      name: "Acme Corporation",
      ownerEmail: "john.smith@acmecorp.com",
      dwollaId: "12345678-1234-5678-9012-123456789012",
    },
    summaryOfBenefits: [
      {
        id: "SOB-001",
        amountToDraft: 12450.0,
        feeAmount: 125.0,
        totalPolicies: 2,
        pdfDocumentUrl: "https://example.com/sob-001.pdf",
        policies: [
          {
            id: "POL-001",
            policyNumber: "POL-2025-001",
            policyHolderName: "John Smith",
            coverageType: "Health Insurance",
            premiumAmount: 8500.0,
            effectiveDate: "2025-01-01",
            expirationDate: "2025-12-31",
            status: "active",
          },
          {
            id: "POL-002",
            policyNumber: "POL-2025-002",
            policyHolderName: "John Smith",
            coverageType: "Dental Coverage",
            premiumAmount: 2200.0,
            effectiveDate: "2025-01-01",
            expirationDate: "2025-12-31",
            status: "active",
          },
        ],
      },
    ],
    activeLists: [
      {
        listId: 1001,
        listName: "High-Value Customers",
        listType: "DYNAMIC",
        membershipTimestamp: "2025-01-15T10:30:00Z",
      },
      {
        listId: 1002,
        listName: "Q1 2025 Campaign Recipients",
        listType: "STATIC",
        membershipTimestamp: "2025-01-10T14:15:00Z",
      },
      {
        listId: 1003,
        listName: "Enterprise Accounts",
        listType: "DYNAMIC",
        membershipTimestamp: "2025-01-12T09:45:00Z",
      },
      {
        listId: 1004,
        listName: "Newsletter Subscribers",
        listType: "DYNAMIC",
        membershipTimestamp: "2025-01-08T16:20:00Z",
      },
    ],
  },
  dwolla: {
    customer: {
      id: "DW-98765",
      email: "billing@acmecorp.com",
      name: "Acme Corporation",
      status: "verified",
    },
    fundingSources: [
      {
        id: "FS-001",
        name: "Business Checking - ****4567",
        type: "bank",
        bankAccountType: "checking",
        accountNumberMasked: "****4567",
        routingNumber: "123456789",
        status: "verified",
      },
    ],
    transfers: [
      {
        id: "TR-001",
        amount: "$2,500.00",
        date: "2023-06-01",
        status: "Completed",
        type: "Withdrawal",
      },
      {
        id: "TR-002",
        amount: "$2,500.00",
        date: "2023-05-01",
        status: "Completed",
        type: "Withdrawal",
      },
      {
        id: "TR-003",
        amount: "$2,500.00",
        date: "2023-04-01",
        status: "Completed",
        type: "Withdrawal",
      },
    ],
    notificationCount: 2,
    notifications: [
      {
        id: "NOT-001",
        message: "Transfer completed successfully",
        date: "2023-06-01",
        type: "Transfer",
      },
      {
        id: "NOT-002",
        message: "Customer verification completed",
        date: "2023-03-15",
        type: "Verification",
      },
    ],
  },
}

export function Dashboard() {
  const [displayData, setDisplayData] = useState<any>(mockData)
  const { result } = useSearchContext()

  // Update display data when backend result changes
  useEffect(() => {
    if (result) {
      setDisplayData(result)
    }
  }, [result])

  return (
    <main className="min-h-screen bg-cakewalk-alice-100 transition-colors duration-300">
      <Header />
      <div className="container mx-auto max-w-7xl px-4 py-6">
        <div className="space-y-6">
          <SearchSection />

          <Tabs defaultValue="customer" className="w-full">
            <TabsList className="mx-auto mb-6 grid max-w-md grid-cols-2">
              <TabsTrigger value="customer">Customer Data</TabsTrigger>
              <TabsTrigger value="lists">List Analytics</TabsTrigger>
            </TabsList>

            <TabsContent value="customer" className="space-y-6">
              <div className="grid grid-cols-1 gap-6 lg:grid-cols-4">
                <div className="lg:col-span-3">
                  <DataPanels data={displayData} />
                </div>
                <div className="lg:col-span-1">
                  <RecentSearches />
                </div>
              </div>
            </TabsContent>

            <TabsContent value="lists" className="space-y-6">
              <ListAnalyticsDashboard />
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </main>
  )
}
