#!/usr/bin/env tsx

/**
 * Report Breakdown Analyzer
 * 
 * Analyzes the merged report to provide detailed carrier and product breakdowns.
 */

import { readFileSync } from 'fs'
import { parse } from 'csv-parse/sync'

interface CarrierBreakdown {
  carrier: string
  totalAmount: number
  policyCount: number
  products: ProductBreakdown[]
}

interface ProductBreakdown {
  productName: string
  totalAmount: number
  policyCount: number
}

class ReportAnalyzer {
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

  analyzeReport(filePath: string): void {
    console.log(`📊 Analyzing report: ${filePath}`)
    const records = this.parseCSV(filePath)
    
    const carrierData: Record<string, CarrierBreakdown> = {}
    let currentCarrier = ''
    
    for (const record of records) {
      const level = record['Level'] || ''
      const name = record['Name'] || ''
      
      if (level === 'Carrier') {
        currentCarrier = name
        if (!carrierData[currentCarrier]) {
          carrierData[currentCarrier] = {
            carrier: currentCarrier,
            totalAmount: 0,
            policyCount: 0,
            products: []
          }
        }
      } else if (level === 'Product') {
        const productName = name.replace('  → ', '')
        const totalAmount = parseFloat(record['Total Amount'] || '0')
        const policyCount = parseInt(record['Policy Count'] || '0')
        
        carrierData[currentCarrier].products.push({
          productName,
          totalAmount,
          policyCount
        })
      }
    }
    
    // Calculate totals
    const grandTotal = Object.values(carrierData).reduce((sum, carrier) => {
      carrier.totalAmount = carrier.products.reduce((sum, product) => sum + product.totalAmount, 0)
      carrier.policyCount = carrier.products.reduce((sum, product) => sum + product.policyCount, 0)
      return sum + carrier.totalAmount
    }, 0)
    
    const totalPolicies = Object.values(carrierData).reduce((sum, carrier) => sum + carrier.policyCount, 0)
    
    // Sort carriers by total amount (descending)
    const sortedCarriers = Object.values(carrierData).sort((a, b) => b.totalAmount - a.totalAmount)
    
    console.log(`\n📈 CARRIER BREAKDOWN`)
    console.log(`===================`)
    console.log(`Total Amount: $${grandTotal.toLocaleString()}`)
    console.log(`Total Policies: ${totalPolicies.toLocaleString()}`)
    console.log(`Total Carriers: ${sortedCarriers.length}`)
    
    console.log(`\n🏢 CARRIER SUMMARY`)
    console.log(`==================`)
    sortedCarriers.forEach((carrier, index) => {
      const percentage = (carrier.totalAmount / grandTotal) * 100
      console.log(`${index + 1}. ${carrier.carrier}`)
      console.log(`   Amount: $${carrier.totalAmount.toLocaleString()} (${percentage.toFixed(1)}%)`)
      console.log(`   Policies: ${carrier.policyCount.toLocaleString()}`)
      console.log(`   Avg per Policy: $${(carrier.totalAmount / carrier.policyCount).toFixed(2)}`)
      console.log('')
    })
    
    console.log(`\n📋 DETAILED PRODUCT BREAKDOWN BY CARRIER`)
    console.log(`=========================================`)
    sortedCarriers.forEach((carrier) => {
      console.log(`\n🏢 ${carrier.carrier} ($${carrier.totalAmount.toLocaleString()})`)
      console.log(`${'='.repeat(50)}`)
      
      // Sort products by amount (descending)
      const sortedProducts = carrier.products.sort((a, b) => b.totalAmount - a.totalAmount)
      
      sortedProducts.forEach((product, index) => {
        const percentage = (product.totalAmount / carrier.totalAmount) * 100
        console.log(`${index + 1}. ${product.productName}`)
        console.log(`   Amount: $${product.totalAmount.toLocaleString()} (${percentage.toFixed(1)}% of carrier)`)
        console.log(`   Policies: ${product.policyCount.toLocaleString()}`)
        console.log(`   Avg per Policy: $${(product.totalAmount / product.policyCount).toFixed(2)}`)
        console.log('')
      })
    })
    
    console.log(`\n📊 TOP PRODUCTS ACROSS ALL CARRIERS`)
    console.log(`===================================`)
    
    // Collect all products and sort by total amount
    const allProducts: ProductBreakdown & { carrier: string }[] = []
    sortedCarriers.forEach(carrier => {
      carrier.products.forEach(product => {
        allProducts.push({
          ...product,
          carrier: carrier.carrier
        })
      })
    })
    
    const topProducts = allProducts.sort((a, b) => b.totalAmount - a.totalAmount).slice(0, 15)
    
    topProducts.forEach((product, index) => {
      const percentage = (product.totalAmount / grandTotal) * 100
      console.log(`${index + 1}. ${product.productName} (${product.carrier})`)
      console.log(`   Amount: $${product.totalAmount.toLocaleString()} (${percentage.toFixed(1)}% of total)`)
      console.log(`   Policies: ${product.policyCount.toLocaleString()}`)
      console.log('')
    })
  }
}

// Main execution
async function main() {
  const reportFile = "TAA-July-Recon-Full (w-Rural).csv"
  const analyzer = new ReportAnalyzer()
  analyzer.analyzeReport(reportFile)
}

if (require.main === module) {
  main().catch(error => {
    console.error('❌ Fatal error:', error)
    process.exit(1)
  })
}
