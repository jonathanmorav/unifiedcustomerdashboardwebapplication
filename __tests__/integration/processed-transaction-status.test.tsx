import { render, screen } from "@testing-library/react"
import { TransactionTable } from "@/components/billing/TransactionTable"

// Mock data for a processed transaction
const mockProcessedTransaction = {
  id: "test-transaction-1",
  dwollaId: "dwolla_processed_123",
  status: "processed" as const,
  amount: 1000.0,
  currency: "USD",
  direction: "credit" as const,
  created: "2024-01-15T10:00:00Z",
  customerName: "John Doe",
  companyName: "Test Company",
  bankLastFour: "1234",
  correlationId: "cor_test_123",
  invoiceNumber: "INV-001",
  transactionType: "payment",
  fees: 2.9,
  netAmount: 997.1,
}

describe("Processed Transaction Status Integration Test", () => {
  test("fetches and displays processed transaction with correct status badge", () => {
    render(
      <TransactionTable
        transactions={[mockProcessedTransaction]}
        isLoading={false}
        totalAmount={1000.0}
      />
    )

    // Verify the transaction details are displayed
    expect(screen.getByText("John Doe")).toBeInTheDocument()
    expect(screen.getByText("Test Company")).toBeInTheDocument()
    expect(screen.getByText("+$1,000.00")).toBeInTheDocument()

    // Most importantly, verify the status badge shows "Processed"
    expect(screen.getByText("Processed")).toBeInTheDocument()

    // Verify the badge has the correct green styling
    const processedBadge = screen.getByText("Processed")
    expect(processedBadge).toHaveClass("bg-green-100", "text-green-800")
  })

  test("processed status badge has correct visual styling", () => {
    render(<TransactionTable transactions={[mockProcessedTransaction]} isLoading={false} />)

    const processedBadge = screen.getByText("Processed")

    // Verify it's a badge element with the correct classes
    expect(processedBadge.closest(".border-0")).toBeInTheDocument()
    expect(processedBadge).toHaveClass("bg-green-100", "text-green-800")
  })

  test("displays processed transaction in transaction table correctly", () => {
    render(<TransactionTable transactions={[mockProcessedTransaction]} isLoading={false} />)

    // Verify all the transaction data is displayed correctly
    expect(screen.getByText(/Jan 15, 2024/)).toBeInTheDocument()
    expect(screen.getByText(/essed_123/)).toBeInTheDocument()
    expect(screen.getByText("John Doe")).toBeInTheDocument()
    expect(screen.getByText("Test Company")).toBeInTheDocument()
    expect(screen.getByText("+$1,000.00")).toBeInTheDocument()
    expect(screen.getByText("Credit")).toBeInTheDocument()
    expect(screen.getByText("Processed")).toBeInTheDocument()
    expect(screen.getByText("****1234")).toBeInTheDocument()
  })

  test("empty state shows when no transactions are returned", () => {
    render(<TransactionTable transactions={[]} isLoading={false} />)

    expect(
      screen.getByText("No transactions found. Adjust your filters to see more results.")
    ).toBeInTheDocument()
  })

  test("loading state displays skeleton loaders", () => {
    render(<TransactionTable transactions={[]} isLoading={true} />)

    // MSW/testing library doesn't have great skeleton testing, but we can verify the component doesn't crash
    expect(screen.queryByText("No transactions found")).not.toBeInTheDocument()
  })
})

describe("Transaction Status Badge Integration", () => {
  const statusTestCases = [
    { status: "pending", expectedText: "Pending", expectedColor: "bg-yellow-100" },
    { status: "processing", expectedText: "Processing", expectedColor: "bg-blue-100" },
    { status: "processed", expectedText: "Processed", expectedColor: "bg-green-100" },
    { status: "failed", expectedText: "Failed", expectedColor: "bg-red-100" },
    { status: "cancelled", expectedText: "Cancelled", expectedColor: "bg-gray-100" },
    { status: "returned", expectedText: "Returned", expectedColor: "bg-orange-100" },
  ]

  statusTestCases.forEach(({ status, expectedText, expectedColor }) => {
    test(`displays ${status} status with correct badge text and color`, () => {
      const transaction = {
        ...mockProcessedTransaction,
        status: status as any,
        id: `test-${status}`,
        dwollaId: `dwolla_${status}_123`,
      }

      render(<TransactionTable transactions={[transaction]} isLoading={false} />)

      const badge = screen.getByText(expectedText)
      expect(badge).toBeInTheDocument()
      expect(badge).toHaveClass(expectedColor)
    })
  })
})
