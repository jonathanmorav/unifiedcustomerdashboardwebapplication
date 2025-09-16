#!/usr/bin/env tsx

/**
 * Product List Extractor
 * 
 * Extracts a clean list of all products per carrier with policy counts and premium amounts.
 */

import { readFileSync } from 'fs'
import { parse } from 'csv-parse/sync'

interface ProductInfo {
  carrier: string
  productName: string
  policyCount: number
  totalAmount: number
}

class ProductListExtractor {
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

  extractProductList(filePath: string): void {
    console.log(`📊 Extracting product list from: ${filePath}`)
    const records = this.parseCSV(filePath)
    
    const products: ProductInfo[] = []
    let currentCarrier = ''
    
    for (const record of records) {
      const level = record['Level'] || ''
      const name = record['Name'] || ''
      
      if (level === 'Carrier') {
        currentCarrier = name
      } else if (level === 'Product') {
        const productName = name.replace('  → ', '')
        const totalAmount = parseFloat(record['Total Amount'] || '0')
        const policyCount = parseInt(record['Policy Count'] || '0')
        
        products.push({
          carrier: currentCarrier,
          productName,
          policyCount,
          totalAmount
        })
      }
    }
    
    // Sort by carrier, then by amount (descending)
    products.sort((a, b) => {
      if (a.carrier !== b.carrier) {
        return a.carrier.localeCompare(b.carrier)
      }
      return b.totalAmount - a.totalAmount
    })
    
    console.log(`\n📋 PRODUCT BREAKDOWN BY CARRIER`)
    console.log(`===============================`)
    
    let currentCarrierGroup = ''
    let carrierTotal = 0
    let carrierPolicyCount = 0
    
    products.forEach((product, index) => {
      if (product.carrier !== currentCarrierGroup) {
        if (currentCarrierGroup !== '') {
          console.log(`\n   CARRIER TOTALS: $${carrierTotal.toLocaleString()} (${carrierPolicyCount} policies)`)
          console.log(`   ${'='.repeat(60)}`)
        }
        
        currentCarrierGroup = product.carrier
        carrierTotal = 0
        carrierPolicyCount = 0
        
        console.log(`\n🏢 ${product.carrier}`)
        console.log(`${'='.repeat(60)}`)
      }
      
      console.log(`${String(index + 1).padStart(2)}. ${product.productName}`)
      console.log(`    Policies: ${product.policyCount.toLocaleString().padStart(6)} | Premium: $${product.totalAmount.toLocaleString().padStart(10)}`)
      
      carrierTotal += product.totalAmount
      carrierPolicyCount += product.policyCount
    })
    
    // Print final carrier totals
    if (currentCarrierGroup !== '') {
      console.log(`\n   CARRIER TOTALS: $${carrierTotal.toLocaleString()} (${carrierPolicyCount} policies)`)
      console.log(`   ${'='.repeat(60)}`)
    }
    
    // Grand totals
    const grandTotal = products.reduce((sum, p) => sum + p.totalAmount, 0)
    const grandPolicyCount = products.reduce((sum, p) => sum + p.policyCount, 0)
    
    console.log(`\n📊 GRAND TOTALS`)
    console.log(`================`)
    console.log(`Total Premium: $${grandTotal.toLocaleString()}`)
    console.log(`Total Policies: ${grandPolicyCount.toLocaleString()}`)
    console.log(`Total Products: ${products.length}`)
    console.log(`Total Carriers: ${new Set(products.map(p => p.carrier)).size}`)
    
    // Summary table
    console.log(`\n📋 SUMMARY TABLE`)
    console.log(`=================`)
    console.log(`Carrier                    | Product                    | Policies | Premium`)
    console.log(`${'='.repeat(80)}`)
    
    products.forEach(product => {
      const carrier = product.carrier.padEnd(25)
      const productName = product.productName.padEnd(25)
      const policies = product.policyCount.toString().padStart(8)
      const premium = `$${product.totalAmount.toLocaleString()}`.padStart(10)
      console.log(`${carrier} | ${productName} | ${policies} | ${premium}`)
    })
  }
}

// Main execution
async function main() {
  const reportFile = "TAA-July-Recon-Full (w-Rural).csv"
  const extractor = new ProductListExtractor()
  extractor.extractProductList(reportFile)
}

if (require.main === module) {
  main().catch(error => {
    console.error('❌ Fatal error:', error)
    process.exit(1)
  })
}
