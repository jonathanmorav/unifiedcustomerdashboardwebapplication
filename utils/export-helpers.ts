import { formatCurrency } from "./format-currency"
import { formatDate } from "./format-date"

export function exportToCSV(data: any, filename: string) {
  // eslint-disable-line @typescript-eslint/no-explicit-any
  const csv = convertToCSV(data)
  downloadFile(csv, `${filename}.csv`, "text/csv")
}

export function exportToJSON(data: any, filename: string) {
  // eslint-disable-line @typescript-eslint/no-explicit-any
  const json = JSON.stringify(data, null, 2)
  downloadFile(json, `${filename}.json`, "application/json")
}

function downloadFile(content: string, filename: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

function convertToCSV(data: any): string {
  // eslint-disable-line @typescript-eslint/no-explicit-any
  const rows: string[][] = []

  // Add metadata
  rows.push(["Export Date", new Date().toISOString()])
  rows.push(["Search Term", data.searchTerm || ""])
  rows.push(["Search Type", data.searchType || ""])
  rows.push([""]) // Empty row

  // HubSpot Data
  if (data.hubspot?.company) {
    rows.push(["HUBSPOT DATA"])
    rows.push(["Company Information"])
    rows.push(["Company ID", data.hubspot.company.id])
    rows.push(["Company Name", data.hubspot.company.name])
    rows.push(["Owner Email", data.hubspot.company.ownerEmail || ""])
    rows.push(["Dwolla ID", data.hubspot.company.dwollaId || ""])
    rows.push([""]) // Empty row

    // Summary of Benefits
    if (data.hubspot.summaryOfBenefits?.length > 0) {
      rows.push(["Summary of Benefits"])
      rows.push(["SOB ID", "Amount to Draft", "Fee Amount", "Total Policies"])

      data.hubspot.summaryOfBenefits.forEach((sob: any) => {
        // eslint-disable-line @typescript-eslint/no-explicit-any
        rows.push([
          sob.id,
          formatCurrency(sob.amountToDraft),
          formatCurrency(sob.feeAmount),
          sob.totalPolicies.toString(),
        ])

        // Policies
        if (sob.policies?.length > 0) {
          rows.push(["", "Policy Number", "Policy Holder", "Coverage Type", "Premium", "Status"])
          sob.policies.forEach((policy: any) => {
            // eslint-disable-line @typescript-eslint/no-explicit-any
            rows.push([
              "",
              policy.policyNumber,
              policy.policyHolderName,
              policy.coverageType,
              formatCurrency(policy.premiumAmount),
              policy.status,
            ])
          })
        }
      })
      rows.push([""]) // Empty row
    }

    // Monthly Invoices
    if (data.hubspot.monthlyInvoices?.length > 0) {
      rows.push(["Monthly Invoices"])
      rows.push(["Invoice Number", "Invoice Date", "Total Amount", "Status"])

      data.hubspot.monthlyInvoices.forEach((invoice: any) => {
        // eslint-disable-line @typescript-eslint/no-explicit-any
        rows.push([
          invoice.invoiceNumber,
          formatDate(invoice.invoiceDate),
          formatCurrency(invoice.totalAmount),
          invoice.status,
        ])
      })
      rows.push([""]) // Empty row
    }
  }

  // Dwolla Data
  if (data.dwolla?.customer) {
    rows.push(["DWOLLA DATA"])
    rows.push(["Customer Information"])
    rows.push(["Customer ID", data.dwolla.customer.id])
    rows.push(["Name", data.dwolla.customer.name])
    rows.push(["Email", data.dwolla.customer.email])
    rows.push(["Business Name", data.dwolla.customer.businessName || ""])
    rows.push(["Status", data.dwolla.customer.status])
    rows.push(["Type", data.dwolla.customer.type])
    rows.push(["Created", formatDate(data.dwolla.customer.created)])
    rows.push([""]) // Empty row

    // Funding Sources
    if (data.dwolla.fundingSources?.length > 0) {
      rows.push(["Funding Sources"])
      rows.push(["Name", "Type", "Bank Account Type", "Account (Masked)", "Status", "Verified"])

      data.dwolla.fundingSources.forEach((source: any) => {
        // eslint-disable-line @typescript-eslint/no-explicit-any
        rows.push([
          source.name,
          source.type,
          source.bankAccountType || "",
          source.accountNumberMasked || "",
          source.status,
          source.verified ? "Yes" : "No",
        ])
      })
      rows.push([""]) // Empty row
    }

    // Transfers
    if (data.dwolla.transfers?.length > 0) {
      rows.push(["Recent Transfers"])
      rows.push(["Transfer ID", "Amount", "Currency", "Status", "Created"])

      data.dwolla.transfers.forEach((transfer: any) => {
        // eslint-disable-line @typescript-eslint/no-explicit-any
        rows.push([
          transfer.id,
          transfer.amount,
          transfer.currency,
          transfer.status,
          formatDate(transfer.created),
        ])
      })
    }
  }

  // Convert to CSV string
  return rows.map((row) => row.map((cell) => `"${cell}"`).join(",")).join("\n")
}
