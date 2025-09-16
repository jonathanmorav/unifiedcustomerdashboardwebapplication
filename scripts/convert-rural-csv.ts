#!/usr/bin/env tsx

/**
 * Rural Insurance CSV Converter
 * 
 * Converts Rural Insurance CSV data into the same hierarchical format
 * as the main company policies report with carrier mapping applied.
 */

import { readFileSync, writeFileSync } from 'fs'
import { parse } from 'csv-parse/sync'
import { stringify } from 'csv-stringify/sync'

// Carrier mapping scheme (from memory)
const CARRIER_MAPPINGS: Record<string, string> = {
  "Accident": "SunLife",
  "Critical Illness": "SunLife",
  "Dental": "SunLife",
  "Excess Disability": "Hanleigh",
  "Excess Disability Insurance": "Hanleigh",
  "Health Cost Sharing": "Sedera",
  "Identity Theft Protection": "SontIQ",
  "Life - Dependent": "SunLife",
  "Long Term Care": "Unum",
  "Long Term Disability": "SunLife",
  "Sedera Health Cost Sharing": "Sedera",
  "Short Term Disability": "SunLife",
  "Telehealth": "Recuro",
  "Vision": "Guardian",
  "Voluntary Life & AD&D": "SunLife"
}

interface PolicyData {
  policyId: string
  policyHolderName: string
  productName: string
  planName?: string
  monthlyCost: number
  coverageLevel: string
  carrier: string
  companyName: string
  sobId: string
}

interface CarrierTotal {
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

class RuralCSVConverter {
  private carrierTotals: Record<string, CarrierTotal> = {}
  private allPolicies: PolicyData[] = []
  private sobId: string = "36311521655"
  private companyName: string = "Rural Insurance"

  /**
   * Get carrier for a product using the mapping scheme
   */
  private getCarrierForProduct(productName: string): string {
    // Direct mapping
    if (CARRIER_MAPPINGS[productName]) {
      return CARRIER_MAPPINGS[productName]
    }

    // Handle specific variations from the Rural Insurance data
    const productLower = productName.toLowerCase()
    
    if (productLower.includes('telemedicine') || productLower.includes('telehealth')) {
      return "Recuro"
    }
    if (productLower.includes('identity theft') || productLower.includes('sontiq')) {
      return "SontIQ"
    }
    if (productLower.includes('health cost sharing') || productLower.includes('sedera')) {
      return "Sedera"
    }
    if (productLower.includes('dependent life') || productLower.includes('life - dependent')) {
      return "SunLife"
    }

    // Try to find partial matches
    for (const [mappedProduct, carrier] of Object.entries(CARRIER_MAPPINGS)) {
      if (productName.toLowerCase().includes(mappedProduct.toLowerCase()) ||
          mappedProduct.toLowerCase().includes(productName.toLowerCase())) {
        return carrier
      }
    }

    return "Unmapped"
  }

  /**
   * Parse the input CSV file
   */
  private parseInputCSV(filePath: string): any[] {
    try {
      const fileContent = readFileSync(filePath, 'utf-8')
      const records = parse(fileContent, {
        columns: true,
        skip_empty_lines: true,
        trim: true
      })

      console.log('📋 CSV Records found:', records.length)
      console.log('📋 Available columns:', records.length > 0 ? Object.keys(records[0]) : 'No records')
      console.log('📋 First few records:', records.slice(0, 3))

      return records
    } catch (error) {
      console.error('❌ Error parsing CSV file:', error)
      process.exit(1)
    }
  }

  /**
   * Process the CSV data and apply carrier mapping
   */
  private processCSVData(records: any[]): void {
    console.log('🔄 Processing CSV data and applying carrier mapping...')

    for (const record of records) {
      // Extract policy data from the record using the actual column names
      const firstName = record['First Name'] || ''
      const lastName = record['Last Name'] || ''
      const policyHolderName = `${firstName} ${lastName}`.trim() || 'Unknown'
      const productName = record['Plan Type'] || 'Unknown Product'
      const planName = record['Enrolled In'] || ''
      const monthlyCostStr = record['Monthly Premium'] || '0'
      // Remove $ and commas from the cost string
      const monthlyCost = parseFloat(monthlyCostStr.replace(/[$,]/g, '')) || 0
      const coverageLevel = record['Enrolled In'] || 'Unknown' // Use Enrolled In as coverage level

      if (policyHolderName === 'Unknown' || productName === 'Unknown Product' || monthlyCost === 0) {
        console.log('⚠️  Skipping record with missing data:', record)
        continue
      }

      const carrier = this.getCarrierForProduct(productName)
      
      const policyData: PolicyData = {
        policyId: `${policyHolderName} - ${productName}`,
        policyHolderName,
        productName,
        planName,
        monthlyCost,
        coverageLevel,
        carrier,
        companyName: this.companyName,
        sobId: this.sobId
      }

      this.allPolicies.push(policyData)
      this.updateCarrierTotals(policyData)
    }

    console.log(`✅ Processed ${this.allPolicies.length} policies`)
  }

  /**
   * Update carrier totals with new policy data
   */
  private updateCarrierTotals(policy: PolicyData): void {
    const carrier = policy.carrier
    
    // Initialize carrier if needed
    if (!this.carrierTotals[carrier]) {
      this.carrierTotals[carrier] = {
        carrier,
        totalAmount: 0,
        policyCount: 0,
        products: {}
      }
    }

    // Initialize product if needed
    if (!this.carrierTotals[carrier].products[policy.productName]) {
      this.carrierTotals[carrier].products[policy.productName] = {
        productName: policy.productName,
        totalAmount: 0,
        policyCount: 0,
        policies: []
      }
    }

    // Update totals
    this.carrierTotals[carrier].totalAmount += policy.monthlyCost
    this.carrierTotals[carrier].policyCount += 1
    
    this.carrierTotals[carrier].products[policy.productName].totalAmount += policy.monthlyCost
    this.carrierTotals[carrier].products[policy.productName].policyCount += 1
    this.carrierTotals[carrier].products[policy.productName].policies.push(policy)
  }

  /**
   * Generate CSV report with Carrier → Product → Policyholder hierarchy
   */
  private generateCSVReport(): string {
    const exportData: any[] = []

    // Sort carriers alphabetically, but put "Unmapped" at the end
    const carrierArray = Object.values(this.carrierTotals).sort((a, b) => {
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
        const sortedPolicies = product.policies.sort((a, b) => a.policyHolderName.localeCompare(b.policyHolderName))
        
        for (const policy of sortedPolicies) {
          exportData.push({
            "Level": "Policy",
            "Name": `    • ${policy.policyHolderName}`,
            "Policy Count": "",
            "Total Amount": "",
            "Company": policy.companyName,
            "SOB ID": policy.sobId,
            "Policy ID": policy.policyId,
            "Policy Holder": policy.policyHolderName,
            "Product Name": policy.productName,
            "Plan Name": policy.planName || "",
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
      "Name": "GRAND TOTAL",
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
   * Main conversion method
   */
  async convertCSV(inputFile: string, outputFile: string): Promise<void> {
    console.log(`🚀 Converting Rural Insurance CSV: ${inputFile}`)
    console.log(`📋 Using SOB ID: ${this.sobId}`)
    console.log(`📋 Using carrier mapping scheme with ${Object.keys(CARRIER_MAPPINGS).length} mappings`)

    // Parse input CSV
    const records = this.parseInputCSV(inputFile)
    
    if (records.length === 0) {
      console.log('❌ No records found in CSV file')
      return
    }

    // Process data and apply carrier mapping
    this.processCSVData(records)

    // Generate report
    console.log(`📊 Generating hierarchical report...`)
    const csvReport = this.generateCSVReport()
    
    // Save report
    writeFileSync(outputFile, csvReport)

    // Print summary
    console.log(`\n✅ Report generated: ${outputFile}`)
    console.log(`\n📈 Summary:`)
    console.log(`   • Company: ${this.companyName}`)
    console.log(`   • SOB ID: ${this.sobId}`)
    console.log(`   • Total policies: ${this.allPolicies.length}`)
    console.log(`   • Total policy amount: $${Object.values(this.carrierTotals).reduce((sum, ct) => sum + ct.totalAmount, 0).toLocaleString()}`)
    console.log(`   • Carriers found: ${Object.keys(this.carrierTotals).length}`)

    // Show carrier breakdown
    console.log(`\n🏢 Carrier Breakdown:`)
    const carrierArray = Object.values(this.carrierTotals)
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
  const args = process.argv.slice(2)
  
  if (args.length === 0) {
    console.log(`
Usage: tsx scripts/convert-rural-csv.ts <input-csv-file>

Input CSV should have columns for:
- Policy Holder (or Policyholder, Name)
- Product (or Product Name, ProductName)
- Plan (or Plan Name, PlanName) - optional
- Cost (or Monthly Cost, Amount, Premium)
- Coverage (or Coverage Level, Level) - optional

Example:
  tsx scripts/convert-rural-csv.ts "Rural Insurance - Sheet1 (1).csv"
`)
    process.exit(1)
  }

  const inputFile = args[0]
  const outputFile = "rural-recon-july.csv"
  
  console.log(`📁 Reading input file: ${inputFile}`)
  console.log(`📁 Output file: ${outputFile}`)

  const converter = new RuralCSVConverter()
  await converter.convertCSV(inputFile, outputFile)
}

// Run if called directly
if (require.main === module) {
  main().catch(error => {
    console.error('❌ Fatal error:', error)
    process.exit(1)
  })
}

export { RuralCSVConverter }
