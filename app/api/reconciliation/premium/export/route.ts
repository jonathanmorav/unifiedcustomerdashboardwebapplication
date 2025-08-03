/**
 * Premium Reconciliation Export API Endpoint
 * 
 * Handles exporting carrier remittance files in various formats (CSV, Excel, PDF)
 */

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { log } from '@/lib/logger'

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const jobId = searchParams.get('jobId')
    const carrier = searchParams.get('carrier')
    const format = searchParams.get('format') || 'csv'

    if (!jobId) {
      return NextResponse.json({ error: 'jobId is required' }, { status: 400 })
    }

    if (!carrier) {
      return NextResponse.json({ error: 'carrier is required' }, { status: 400 })
    }

    // Get the reconciliation job
    const job = await prisma.reconciliationJob.findUnique({
      where: { id: jobId }
    })

    if (!job) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 })
    }

    if (job.status !== 'completed') {
      return NextResponse.json({ error: 'Job not completed' }, { status: 400 })
    }

    const results = job.results as any
    if (!results?.report?.carrierRemittances) {
      return NextResponse.json({ error: 'No remittance data available' }, { status: 404 })
    }

    // Find the specific carrier data
    const carrierData = results.report.carrierRemittances.find(
      (c: any) => c.carrier === carrier
    )

    if (!carrierData) {
      return NextResponse.json({ error: 'Carrier not found in report' }, { status: 404 })
    }

    // Generate the export file based on format
    switch (format.toLowerCase()) {
      case 'csv':
        return generateCSVExport(carrierData, results.report.billingPeriod)
      case 'xlsx':
        return generateExcelExport(carrierData, results.report.billingPeriod)
      case 'pdf':
        return generatePDFExport(carrierData, results.report.billingPeriod)
      default:
        return NextResponse.json({ error: 'Unsupported format' }, { status: 400 })
    }

  } catch (error) {
    log.error('Error exporting carrier remittance file', error as Error, {
      operation: 'export_carrier_remittance'
    })
    
    return NextResponse.json(
      { error: 'Failed to export carrier remittance file' },
      { status: 500 }
    )
  }
}

/**
 * Generate CSV export for carrier remittance
 */
function generateCSVExport(carrierData: any, billingPeriod: string) {
  const headers = [
    'Policy Type',
    'Client ID',
    'Client Name',
    'Employee ID',
    'Employee Name',
    'Policy Number',
    'Premium Amount',
    'Coverage Level',
    'Coverage Amount'
  ]

  const rows: string[][] = []
  
  // Add header row
  rows.push(headers)

  // Add summary row
  rows.push([
    'SUMMARY',
    '',
    '',
    '',
    '',
    '',
    carrierData.totalDue.toString(),
    '',
    ''
  ])

  // Add empty row for separation
  rows.push(Array(headers.length).fill(''))

  // Add data rows
  for (const policyDetail of carrierData.policyDetails) {
    for (const client of policyDetail.clientRoster) {
      // Find line items for this client and policy type
      const lineItems = policyDetail.lineItems?.filter(
        (item: any) => item.clientId === client.clientId
      ) || []

      if (lineItems.length === 0) {
        // If no line items, create a summary row for the client
        rows.push([
          policyDetail.policyType,
          client.clientId,
          client.clientName,
          '',
          '',
          '',
          client.totalPremium.toString(),
          '',
          ''
        ])
      } else {
        // Add individual line items
        for (const item of lineItems) {
          rows.push([
            policyDetail.policyType,
            item.clientId,
            item.clientName,
            item.employeeId,
            item.employeeName,
            item.policyNumber,
            item.premium.toString(),
            item.coverageLevel,
            item.coverageAmount?.toString() || ''
          ])
        }
      }
    }
  }

  // Convert to CSV format
  const csvContent = rows
    .map(row => 
      row.map(cell => 
        // Escape quotes and wrap in quotes if contains comma, quote, or newline
        cell.includes(',') || cell.includes('"') || cell.includes('\n')
          ? `"${cell.replace(/"/g, '""')}"`
          : cell
      ).join(',')
    )
    .join('\n')

  // Create response
  const response = new NextResponse(csvContent, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv',
      'Content-Disposition': `attachment; filename="${carrierData.carrier}_remittance_${billingPeriod}.csv"`
    }
  })

  return response
}

/**
 * Generate Excel export for carrier remittance
 */
function generateExcelExport(carrierData: any, billingPeriod: string) {
  // For now, return CSV with Excel MIME type
  // In a production environment, you would use a library like xlsx or exceljs
  const csvResponse = generateCSVExport(carrierData, billingPeriod)
  
  // Update headers for Excel
  const headers = new Headers(csvResponse.headers)
  headers.set('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
  headers.set('Content-Disposition', `attachment; filename="${carrierData.carrier}_remittance_${billingPeriod}.xlsx"`)
  
  return new NextResponse(csvResponse.body, {
    status: 200,
    headers
  })
}

/**
 * Generate PDF export for carrier remittance
 */
function generatePDFExport(carrierData: any, billingPeriod: string) {
  // For now, return a simple text representation
  // In a production environment, you would use a library like puppeteer or jsPDF
  const content = `
CARRIER REMITTANCE REPORT
Carrier: ${carrierData.carrier}
Billing Period: ${billingPeriod}
Total Due: $${carrierData.totalDue.toFixed(2)}
Generated: ${new Date().toISOString()}

POLICY BREAKDOWN:
${carrierData.policyDetails.map((policy: any) => `
Policy Type: ${policy.policyType}
Count: ${policy.count}
Total Premium: $${policy.totalPremium.toFixed(2)}

Clients:
${policy.clientRoster.map((client: any) => `
  - ${client.clientName} (ID: ${client.clientId})
    Employees: ${client.employeeCount}
    Total Premium: $${client.totalPremium.toFixed(2)}
`).join('')}
`).join('')}
`

  return new NextResponse(content, {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${carrierData.carrier}_remittance_${billingPeriod}.pdf"`
    }
  })
}