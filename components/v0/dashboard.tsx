"use client"

import { useState, useEffect } from "react"
import { Header } from "./header"
import { SearchSection } from "./search-section"
import { DataPanels } from "./data-panels"
import { RecentSearches } from "./recent-searches"
import { useSearch } from "@/hooks/use-search"

// Mock data for demonstration (same as in V0)
const mockData = {
  hubspot: {
    company: {
      id: "CMP-12345",
      name: "Acme Corporation",
      ownerEmail: "john.smith@acmecorp.com",
    },
    summaryOfBenefits: {
      amountToDraft: "$2,500.00",
      feeAmount: "$125.00",
      monthlyInvoice: "INV-789012",
      policies: [
        {
          id: "POL-001",
          name: "Health Insurance",
          amount: "$1,200.00",
          status: "Active",
        },
        {
          id: "POL-002",
          name: "Dental Insurance",
          amount: "$300.00",
          status: "Active",
        },
        {
          id: "POL-003",
          name: "Vision Insurance",
          amount: "$150.00",
          status: "Pending",
        },
        {
          id: "POL-004",
          name: "Life Insurance",
          amount: "$850.00",
          status: "Failed",
        },
      ],
    },
  },
  dwolla: {
    customer: {
      id: "DW-98765",
      email: "billing@acmecorp.com",
      name: "Acme Corporation",
      status: "Verified",
    },
    fundingSource: {
      accountType: "checking",
      accountNumber: "****4567",
      routingNumber: "123456789",
      verificationStatus: "Verified",
    },
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
  const { search, isLoading, error, result } = useSearch()

  // Update display data when backend result changes
  useEffect(() => {
    if (result) {
      setDisplayData(result)
    }
  }, [result])

  return (
    <main className="min-h-screen bg-cakewalk-alice-100 transition-colors duration-300">
      <Header />
      <div className="container mx-auto px-4 py-6 max-w-7xl">
        <div className="space-y-6">
          <SearchSection />
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
            <div className="lg:col-span-3">
              <DataPanels data={displayData} />
            </div>
            <div className="lg:col-span-1">
              <RecentSearches />
            </div>
          </div>
        </div>
      </div>
    </main>
  )
}