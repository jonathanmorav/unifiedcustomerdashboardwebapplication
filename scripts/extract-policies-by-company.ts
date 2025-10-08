#!/usr/bin/env tsx

/**
 * Company Policy Extractor
 * 
 * Takes a list of company names and amounts collected, then extracts all policies
 * associated with those companies and maps them to carriers using the existing
 * carrier mapping scheme.
 * 
 * Usage:
 * 1. Create a CSV file with columns: Company Name, Amount Collected
 * 2. Run: tsx scripts/extract-policies-by-company.ts <input-csv-file>
 * 3. Get output: company-policies-report-YYYY-MM-DD.csv
 */

import { readFileSync, writeFileSync } from 'fs'
import { parse } from 'csv-parse/sync'
import { stringify } from 'csv-stringify/sync'
import { HubSpotService } from '../lib/api/hubspot/service'
import { prisma } from '../lib/db'
import { logger } from '../lib/logger'

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

interface CompanyInput {
  companyName: string
  amountCollected: number
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

class CompanyPolicyExtractor {
  private hubspotService: HubSpotService
  private carrierTotals: Record<string, CarrierTotal> = {}
  private allPolicies: PolicyData[] = []
  private processedCompanies: string[] = []
  private failedCompanies: string[] = []

  constructor() {
    this.hubspotService = new HubSpotService()
  }

  /**
   * Get carrier for a product using the mapping scheme
   */
  private getCarrierForProduct(productName: string): string {
    // Direct mapping
    if (CARRIER_MAPPINGS[productName]) {
      return CARRIER_MAPPINGS[productName]
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
   * Process a single company
   */
  private async processCompany(companyInput: CompanyInput): Promise<void> {
    const { companyName, amountCollected } = companyInput
    
    console.log(`\n🔍 Processing company: ${companyName} ($${amountCollected.toLocaleString()})`)
    
    try {
      // Search for company in HubSpot
      const customerData = await this.hubspotService.searchCustomer({
        searchTerm: companyName,
        searchType: "business_name"
      })

      if (!customerData) {
        console.log(`❌ Company not found in HubSpot: ${companyName}`)
        this.failedCompanies.push(companyName)
        return
      }

      console.log(`✅ Found company: ${customerData.company.name} (ID: ${customerData.company.id})`)

      if (!customerData.summaryOfBenefits?.length) {
        console.log(`⚠️  No Summary of Benefits found for: ${companyName}`)
        this.failedCompanies.push(companyName)
        return
      }

      // Get the latest SOB
      const latestSOB = customerData.summaryOfBenefits[0]
      console.log(`📋 Using SOB: ${latestSOB.id} (${latestSOB.coverageMonth || 'No coverage month'})`)

      // Process all policies
      let companyPolicyCount = 0
      let companyTotalAmount = 0

      for (const policy of customerData.policies) {
        const props = policy.properties
        
        const policyHolderName = props.policyholder || 
          `${props.first_name || ""} ${props.last_name || ""}`.trim() || 
          "Unknown Policyholder"
        
        const productName = String(props.product_name || "Unknown Product")
        const carrier = this.getCarrierForProduct(productName)
        
        const monthlyCost = typeof props.cost_per_month === 'string' 
          ? parseFloat(props.cost_per_month) 
          : (props.cost_per_month || 0)

        const policyData: PolicyData = {
          policyId: `${policyHolderName} - ${productName}`,
          policyHolderName,
          productName,
          planName: props.plan_name,
          monthlyCost,
          coverageLevel: props.coverage_level_display || props.coverage_level || "Unknown",
          carrier,
          companyName: customerData.company.name,
          sobId: latestSOB.id
        }

        this.allPolicies.push(policyData)
        companyPolicyCount++
        companyTotalAmount += monthlyCost

        // Update carrier totals
        this.updateCarrierTotals(policyData)
      }

      console.log(`📊 Extracted ${companyPolicyCount} policies totaling $${companyTotalAmount.toLocaleString()}`)
      console.log(`💰 Expected vs Collected: $${companyTotalAmount.toLocaleString()} vs $${amountCollected.toLocaleString()}`)
      
      if (Math.abs(companyTotalAmount - amountCollected) > 100) {
        console.log(`⚠️  Variance detected: $${Math.abs(companyTotalAmount - amountCollected).toLocaleString()}`)
      }

      this.processedCompanies.push(companyName)

    } catch (error) {
      console.error(`❌ Error processing company ${companyName}:`, error)
      this.failedCompanies.push(companyName)
    }
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
   * Main execution method
   */
  async extractPolicies(companies: CompanyInput[]): Promise<void> {
    console.log(`🚀 Starting policy extraction for ${companies.length} companies...`)
    console.log(`📋 Using carrier mapping scheme with ${Object.keys(CARRIER_MAPPINGS).length} mappings`)

    // Process companies sequentially to avoid rate limits
    for (let i = 0; i < companies.length; i++) {
      const company = companies[i]
      console.log(`\n📈 Progress: ${i + 1}/${companies.length}`)
      
      await this.processCompany(company)
      
      // Small delay to be respectful to HubSpot API
      if (i < companies.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 1000))
      }
    }

    // Generate report
    console.log(`\n📊 Generating report...`)
    const csvReport = this.generateCSVReport()
    
    // Save report
    const timestamp = new Date().toISOString().split('T')[0]
    const filename = `company-policies-report-${timestamp}.csv`
    writeFileSync(filename, csvReport)

    // Print summary
    console.log(`\n✅ Report generated: ${filename}`)
    console.log(`\n📈 Summary:`)
    console.log(`   • Companies processed: ${this.processedCompanies.length}`)
    console.log(`   • Companies failed: ${this.failedCompanies.length}`)
    console.log(`   • Total policies extracted: ${this.allPolicies.length}`)
    console.log(`   • Total policy amount: $${Object.values(this.carrierTotals).reduce((sum, ct) => sum + ct.totalAmount, 0).toLocaleString()}`)
    console.log(`   • Carriers found: ${Object.keys(this.carrierTotals).length}`)

    if (this.failedCompanies.length > 0) {
      console.log(`\n❌ Failed companies:`)
      this.failedCompanies.forEach(company => console.log(`   • ${company}`))
    }

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
 * Parse CSV input file
 */
function parseInputCSV(filePath: string): CompanyInput[] {
  try {
    const fileContent = readFileSync(filePath, 'utf-8')
    const records = parse(fileContent, {
      columns: true,
      skip_empty_lines: true,
      trim: true
    })

    // Remove debug logging for cleaner output

    return records.map((record: any) => ({
      companyName: record['SUM of Dwolla Amount'] || record['Associated Company'] || record['Company Name'] || record['company_name'] || record['Company'],
      amountCollected: parseFloat(record['ex. Fees (1.32)'] || record['July Premium'] || record['Amount Collected'] || record['amount_collected'] || record['Amount'] || '0')
    })).filter(company => company.companyName && company.amountCollected > 0 && company.companyName !== 'Associated Company')

  } catch (error) {
    console.error('❌ Error parsing CSV file:', error)
    process.exit(1)
  }
}

/**
 * Main execution
 */
async function main() {
  const args = process.argv.slice(2)
  
  if (args.length === 0) {
    console.log(`
Usage: tsx scripts/extract-policies-by-company.ts <input-csv-file>

Input CSV should have columns:
- Company Name (or company_name, Company)
- Amount Collected (or amount_collected, Amount)

Example:
  tsx scripts/extract-policies-by-company.ts billing-data.csv
`)
    process.exit(1)
  }

  const inputFile = args[0]
  console.log(`📁 Reading input file: ${inputFile}`)

  const companies = parseInputCSV(inputFile)
  console.log(`📋 Found ${companies.length} companies to process`)

  if (companies.length === 0) {
    console.log('❌ No valid companies found in CSV file')
    process.exit(1)
  }

  const extractor = new CompanyPolicyExtractor()
  await extractor.extractPolicies(companies)
}

// Run if called directly
if (require.main === module) {
  main().catch(error => {
    console.error('❌ Fatal error:', error)
    process.exit(1)
  })
}

export { CompanyPolicyExtractor }
