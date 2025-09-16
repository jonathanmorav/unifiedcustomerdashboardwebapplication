#!/usr/bin/env tsx

/**
 * Report Merger
 * 
 * Merges the main company policies report with the Rural Insurance report
 * and updates all totals to reflect the combined data.
 */

import { readFileSync, writeFileSync } from 'fs'
import { parse } from 'csv-parse/sync'
import { stringify } from 'csv-stringify/sync'

interface PolicyData {
  level: string
  name: string
  policyCount: string
  totalAmount: string
  company: string
  sobId: string
  policyId: string
  policyHolder: string
  productName: string
  planName: string
  monthlyCost: string
  coverageLevel: string
}

interface CarrierData {
  carrier: string
  totalAmount: number
  policyCount: number
  products: Record<string, {
    productName: string
    totalAmount: number
    policyCount: number
    policies: PolicyData[]
  }>
}

class ReportMerger {
  private carrierData: Record<string, CarrierData> = {}
  private allPolicies: PolicyData[] = []

  /**
   * Parse CSV file and return records
   */
  private parseCSV(filePath: string): any[] {
    try {
      const fileContent = readFileSync(filePath, 'utf-8')
      const records = parse(fileContent, {
        columns: true,
        skip_empty_lines: true,
        trim: true
      })
      return records
    } catch (error) {
      console.error(`❌ Error parsing CSV file ${filePath}:`, error)
      process.exit(1)
    }
  }

  /**
   * Process the main company policies report
   */
  private processMainReport(filePath: string): void {
    console.log(`📊 Processing main report: ${filePath}`)
    const records = this.parseCSV(filePath)
    
    let currentCarrier = ''
    let currentProduct = ''
    
    for (const record of records) {
      const level = record['Level'] || ''
      const name = record['Name'] || ''
      
      if (level === 'Carrier') {
        currentCarrier = name
        if (!this.carrierData[currentCarrier]) {
          this.carrierData[currentCarrier] = {
            carrier: currentCarrier,
            totalAmount: 0,
            policyCount: 0,
            products: {}
          }
        }
      } else if (level === 'Product') {
        currentProduct = name.replace('  → ', '')
        if (!this.carrierData[currentCarrier].products[currentProduct]) {
          this.carrierData[currentCarrier].products[currentProduct] = {
            productName: currentProduct,
            totalAmount: 0,
            policyCount: 0,
            policies: []
          }
        }
      } else if (level === 'Policy') {
        const policyData: PolicyData = {
          level: 'Policy',
          name: name,
          policyCount: '',
          totalAmount: '',
          company: record['Company'] || '',
          sobId: record['SOB ID'] || '',
          policyId: record['Policy ID'] || '',
          policyHolder: record['Policy Holder'] || '',
          productName: record['Product Name'] || '',
          planName: record['Plan Name'] || '',
          monthlyCost: record['Monthly Cost'] || '',
          coverageLevel: record['Coverage Level'] || ''
        }
        
        this.allPolicies.push(policyData)
        this.carrierData[currentCarrier].products[currentProduct].policies.push(policyData)
        
        // Update totals
        const monthlyCost = parseFloat(record['Monthly Cost'] || '0')
        this.carrierData[currentCarrier].totalAmount += monthlyCost
        this.carrierData[currentCarrier].policyCount += 1
        this.carrierData[currentCarrier].products[currentProduct].totalAmount += monthlyCost
        this.carrierData[currentCarrier].products[currentProduct].policyCount += 1
      }
    }
    
    console.log(`✅ Processed main report: ${this.allPolicies.length} policies`)
  }

  /**
   * Process the Rural Insurance report
   */
  private processRuralReport(filePath: string): void {
    console.log(`📊 Processing Rural Insurance report: ${filePath}`)
    const records = this.parseCSV(filePath)
    
    let currentCarrier = ''
    let currentProduct = ''
    
    for (const record of records) {
      const level = record['Level'] || ''
      const name = record['Name'] || ''
      
      if (level === 'Carrier') {
        currentCarrier = name
        if (!this.carrierData[currentCarrier]) {
          this.carrierData[currentCarrier] = {
            carrier: currentCarrier,
            totalAmount: 0,
            policyCount: 0,
            products: {}
          }
        }
      } else if (level === 'Product') {
        currentProduct = name.replace('  → ', '')
        if (!this.carrierData[currentCarrier].products[currentProduct]) {
          this.carrierData[currentCarrier].products[currentProduct] = {
            productName: currentProduct,
            totalAmount: 0,
            policyCount: 0,
            policies: []
          }
        }
      } else if (level === 'Policy') {
        const policyData: PolicyData = {
          level: 'Policy',
          name: name,
          policyCount: '',
          totalAmount: '',
          company: record['Company'] || '',
          sobId: record['SOB ID'] || '',
          policyId: record['Policy ID'] || '',
          policyHolder: record['Policy Holder'] || '',
          productName: record['Product Name'] || '',
          planName: record['Plan Name'] || '',
          monthlyCost: record['Monthly Cost'] || '',
          coverageLevel: record['Coverage Level'] || ''
        }
        
        this.allPolicies.push(policyData)
        this.carrierData[currentCarrier].products[currentProduct].policies.push(policyData)
        
        // Update totals
        const monthlyCost = parseFloat(record['Monthly Cost'] || '0')
        this.carrierData[currentCarrier].totalAmount += monthlyCost
        this.carrierData[currentCarrier].policyCount += 1
        this.carrierData[currentCarrier].products[currentProduct].totalAmount += monthlyCost
        this.carrierData[currentCarrier].products[currentProduct].policyCount += 1
      }
    }
    
    console.log(`✅ Processed Rural Insurance report: ${this.allPolicies.length} total policies`)
  }

  /**
   * Generate merged CSV report
   */
  private generateMergedReport(): string {
    const exportData: any[] = []

    // Sort carriers alphabetically, but put "Unmapped" at the end
    const carrierArray = Object.values(this.carrierData).sort((a, b) => {
      if (a.carrier === "Unmapped") return 1
      if (b.carrier === "Unmapped") return -1
      return a.carrier.localeCompare(b.carrier)
    })

    // Generate hierarchical report: Carrier → Product → Policyholder
    for (const carrier of carrierArray) {
      // Level 1: Carrier Header
      exportData.push({
        "Level": "Carrier",
        "Name": carrier.carrier,
        "Policy Count": carrier.policyCount,
        "Total Amount": carrier.totalAmount,
        "Company": "",
        "SOB ID": "",
        "Policy ID": "",
        "Policy Holder": "",
        "Product Name": "",
        "Plan Name": "",
        "Monthly Cost": "",
        "Coverage Level": "",
      })

      // Level 2: Products under this carrier
      const products = Object.values(carrier.products).sort((a, b) => a.productName.localeCompare(b.productName))
      
      for (const product of products) {
        // Product Header
        exportData.push({
          "Level": "Product",
          "Name": `  → ${product.productName}`,
          "Policy Count": product.policyCount,
          "Total Amount": product.totalAmount,
          "Company": "",
          "SOB ID": "",
          "Policy ID": "",
          "Policy Holder": "",
          "Product Name": "",
          "Plan Name": "",
          "Monthly Cost": "",
          "Coverage Level": "",
        })

        // Level 3: Individual policies under this product
        const sortedPolicies = product.policies.sort((a, b) => a.policyHolder.localeCompare(b.policyHolder))
        
        for (const policy of sortedPolicies) {
          exportData.push({
            "Level": "Policy",
            "Name": `    • ${policy.policyHolder}`,
            "Policy Count": "",
            "Total Amount": "",
            "Company": policy.company,
            "SOB ID": policy.sobId,
            "Policy ID": policy.policyId,
            "Policy Holder": policy.policyHolder,
            "Product Name": policy.productName,
            "Plan Name": policy.planName,
            "Monthly Cost": policy.monthlyCost,
            "Coverage Level": policy.coverageLevel,
          })
        }
      }

      // Add empty row between carriers
      exportData.push({})
    }

    // Add grand total
    const grandTotal = carrierArray.reduce((sum, ct) => sum + ct.totalAmount, 0)
    const totalPolicies = carrierArray.reduce((sum, ct) => sum + ct.policyCount, 0)
    
    exportData.push({
      "Level": "TOTAL",
      "Name": "GRAND TOTAL (INCLUDING RURAL INSURANCE)",
      "Policy Count": totalPolicies,
      "Total Amount": grandTotal,
      "Company": "",
      "SOB ID": "",
      "Policy ID": "",
      "Policy Holder": "",
      "Product Name": "",
      "Plan Name": "",
      "Monthly Cost": "",
      "Coverage Level": "",
    })

    return stringify(exportData, { header: true })
  }

  /**
   * Main merge method
   */
  async mergeReports(mainReportPath: string, ruralReportPath: string, outputPath: string): Promise<void> {
    console.log(`🚀 Starting report merge...`)
    console.log(`📊 Main report: ${mainReportPath}`)
    console.log(`📊 Rural report: ${ruralReportPath}`)
    console.log(`📁 Output file: ${outputPath}`)

    // Process both reports
    this.processMainReport(mainReportPath)
    this.processRuralReport(ruralReportPath)

    // Generate merged report
    console.log(`📊 Generating merged report...`)
    const mergedCSV = this.generateMergedReport()
    
    // Save merged report
    writeFileSync(outputPath, mergedCSV)

    // Print summary
    console.log(`\n✅ Merged report generated: ${outputPath}`)
    console.log(`\n📈 Combined Summary:`)
    console.log(`   • Total policies: ${this.allPolicies.length}`)
    console.log(`   • Total policy amount: $${Object.values(this.carrierData).reduce((sum, ct) => sum + ct.totalAmount, 0).toLocaleString()}`)
    console.log(`   • Carriers found: ${Object.keys(this.carrierData).length}`)

    // Show carrier breakdown
    console.log(`\n🏢 Combined Carrier Breakdown:`)
    const carrierArray = Object.values(this.carrierData)
    for (const carrier of carrierArray) {
      const percentage = carrierArray.reduce((sum, ct) => sum + ct.totalAmount, 0) > 0 
        ? (carrier.totalAmount / carrierArray.reduce((sum, ct) => sum + ct.totalAmount, 0)) * 100 
        : 0
      console.log(`   • ${carrier.carrier}: $${carrier.totalAmount.toLocaleString()} (${carrier.policyCount} policies, ${percentage.toFixed(1)}%)`)
    }
  }
}

/**
 * Main execution
 */
async function main() {
  const mainReport = "company-policies-report-2025-09-02.csv"
  const ruralReport = "rural-recon-july.csv"
  const outputFile = "TAA-July-Recon-Full (w-Rural).csv"
  
  console.log(`📁 Reading main report: ${mainReport}`)
  console.log(`📁 Reading Rural report: ${ruralReport}`)
  console.log(`📁 Output file: ${outputFile}`)

  const merger = new ReportMerger()
  await merger.mergeReports(mainReport, ruralReport, outputFile)
}

// Run if called directly
if (require.main === module) {
  main().catch(error => {
    console.error('❌ Fatal error:', error)
    process.exit(1)
  })
}

export { ReportMerger }
