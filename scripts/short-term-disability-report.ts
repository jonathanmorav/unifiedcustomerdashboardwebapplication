#!/usr/bin/env tsx

import { promises as fs } from "fs"
import { parse } from "csv-parse/sync"
import path from "path"

interface PolicyRecord {
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

interface ReportSummary {
  agentRecords: number
  agentCoverageAmount: number
  staffRecords: number
  staffCoverageAmount: number
  totalRecords: number
  totalCoverageAmount: number
}

class ShortTermDisabilityReporter {
  private csvData: PolicyRecord[] = []

  async loadCSV(filePath: string): Promise<void> {
    try {
      const fileContent = await fs.readFile(filePath, 'utf-8')
      const records = parse(fileContent, {
        columns: [
          'level',
          'name', 
          'policyCount',
          'totalAmount',
          'company',
          'sobId',
          'policyId',
          'policyHolder',
          'productName',
          'planName',
          'monthlyCost',
          'coverageLevel'
        ],
        skip_empty_lines: true,
        trim: true
      })
      
      this.csvData = records.slice(1) // Skip header row
      console.log(`✅ Loaded ${this.csvData.length} records from CSV`)
      
    } catch (error) {
      console.error("❌ Error loading CSV:", error)
      throw error
    }
  }

  private parseAmount(amountString: string): number {
    if (!amountString || amountString === '') return 0
    // Remove any currency symbols and parse as float
    const cleaned = amountString.replace(/[$,]/g, '')
    const parsed = parseFloat(cleaned)
    return isNaN(parsed) ? 0 : parsed
  }

  private isShortTermDisabilityPolicy(record: PolicyRecord): boolean {
    return record.level === 'Policy' && 
           (record.name.toLowerCase().includes('short term disability') || 
            record.productName.toLowerCase().includes('short term disability'))
  }

  private isAgentPolicy(record: PolicyRecord): boolean {
    return record.name.toLowerCase().includes('agent') ||
           record.planName.toLowerCase().includes('agent') ||
           record.coverageLevel.toLowerCase().includes('agent')
  }

  private isStaffPolicy(record: PolicyRecord): boolean {
    return record.name.toLowerCase().includes('staff') ||
           record.planName.toLowerCase().includes('staff') ||
           record.coverageLevel.toLowerCase().includes('staff')
  }

  generateReport(): ReportSummary {
    console.log("🔍 Analyzing Short Term Disability policies...")
    console.log("=" .repeat(80))

    const shortTermDisabilityPolicies = this.csvData.filter(record => 
      this.isShortTermDisabilityPolicy(record)
    )

    console.log(`📊 Found ${shortTermDisabilityPolicies.length} Short Term Disability policies`)
    
    // Separate Agent and Staff policies
    const agentPolicies = shortTermDisabilityPolicies.filter(record => 
      this.isAgentPolicy(record)
    )
    
    const staffPolicies = shortTermDisabilityPolicies.filter(record => 
      this.isStaffPolicy(record)
    )

    // Calculate totals
    const agentCoverageAmount = agentPolicies.reduce((sum, record) => 
      sum + this.parseAmount(record.monthlyCost), 0
    )
    
    const staffCoverageAmount = staffPolicies.reduce((sum, record) => 
      sum + this.parseAmount(record.monthlyCost), 0
    )

    const report: ReportSummary = {
      agentRecords: agentPolicies.length,
      agentCoverageAmount: agentCoverageAmount,
      staffRecords: staffPolicies.length, 
      staffCoverageAmount: staffCoverageAmount,
      totalRecords: agentPolicies.length + staffPolicies.length,
      totalCoverageAmount: agentCoverageAmount + staffCoverageAmount
    }

    this.displayReport(report)
    this.displaySamplePolicies(agentPolicies, staffPolicies)
    
    return report
  }

  private displayReport(report: ReportSummary): void {
    console.log("\n📈 SHORT TERM DISABILITY COVERAGE REPORT")
    console.log("=" .repeat(80))
    
    console.log("\n🏢 SHORT TERM DISABILITY - AGENTS")
    console.log(`   Total Records: ${report.agentRecords.toLocaleString()}`)
    console.log(`   Coverage Amount: $${report.agentCoverageAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`)
    
    console.log("\n👥 SHORT TERM DISABILITY - STAFF") 
    console.log(`   Total Records: ${report.staffRecords.toLocaleString()}`)
    console.log(`   Coverage Amount: $${report.staffCoverageAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`)
    
    console.log("\n📊 COMBINED TOTALS")
    console.log(`   Total Records: ${report.totalRecords.toLocaleString()}`)
    console.log(`   Total Coverage Amount: $${report.totalCoverageAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`)
    
    console.log("\n💰 AVERAGE COVERAGE PER RECORD")
    if (report.agentRecords > 0) {
      const avgAgent = report.agentCoverageAmount / report.agentRecords
      console.log(`   Average Agent Coverage: $${avgAgent.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`)
    }
    if (report.staffRecords > 0) {
      const avgStaff = report.staffCoverageAmount / report.staffRecords
      console.log(`   Average Staff Coverage: $${avgStaff.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`)
    }
  }

  private displaySamplePolicies(agentPolicies: PolicyRecord[], staffPolicies: PolicyRecord[]): void {
    console.log("\n🔍 SAMPLE POLICIES")
    console.log("=" .repeat(80))
    
    console.log("\n📋 Agent Policies (First 5):")
    agentPolicies.slice(0, 5).forEach((policy, index) => {
      console.log(`   ${index + 1}. ${policy.policyHolder || policy.name.replace('    • ', '')}`)
      console.log(`      Plan: ${policy.planName || 'Standard'}`)  
      console.log(`      Monthly Cost: $${this.parseAmount(policy.monthlyCost).toFixed(2)}`)
      console.log(`      Coverage Level: ${policy.coverageLevel}`)
      console.log()
    })
    
    console.log("📋 Staff Policies (First 5):")
    staffPolicies.slice(0, 5).forEach((policy, index) => {
      console.log(`   ${index + 1}. ${policy.policyHolder || policy.name.replace('    • ', '')}`)
      console.log(`      Plan: ${policy.planName || 'Standard'}`)
      console.log(`      Monthly Cost: $${this.parseAmount(policy.monthlyCost).toFixed(2)}`)  
      console.log(`      Coverage Level: ${policy.coverageLevel}`)
      console.log()
    })
  }

  async exportToCSV(report: ReportSummary): Promise<string> {
    const timestamp = new Date().toISOString().slice(0, 19).replace(/[:-]/g, '')
    const filename = `short-term-disability-report-${timestamp}.csv`
    const filePath = path.join(process.cwd(), filename)
    
    const csvContent = [
      'Category,Record Count,Coverage Amount',
      `Short Term Disability - Agents,${report.agentRecords},${report.agentCoverageAmount.toFixed(2)}`,
      `Short Term Disability - Staff,${report.staffRecords},${report.staffCoverageAmount.toFixed(2)}`,
      `TOTAL,${report.totalRecords},${report.totalCoverageAmount.toFixed(2)}`
    ].join('\n')
    
    await fs.writeFile(filePath, csvContent)
    console.log(`\n📄 Report exported to: ${filename}`)
    
    return filename
  }
}

async function main() {
  const reporter = new ShortTermDisabilityReporter()
  
  try {
    console.log("🚀 Starting Short Term Disability Coverage Report")
    console.log("=" .repeat(80))
    
    // Load the CSV file
    const csvPath = path.join(process.cwd(), 'TAA-July-Recon-Full (w-Rural).csv')
    await reporter.loadCSV(csvPath)
    
    // Generate the report
    const report = reporter.generateReport()
    
    // Export to CSV
    await reporter.exportToCSV(report)
    
    console.log("\n✅ Report generation complete!")
    
  } catch (error) {
    console.error("❌ Error generating report:", error)
    process.exit(1)
  }
}

if (require.main === module) {
  main()
}

export { ShortTermDisabilityReporter }

