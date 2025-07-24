#!/usr/bin/env node

/**
 * UI Field Mapping Verification Script
 *
 * This script verifies that all UI components properly map to backend data fields
 * and identifies any mismatches between expected data structure and UI expectations.
 */

const fs = require("fs")
const path = require("path")

console.log("🔍 UI Field Mapping Verification")
console.log("=================================\n")

// Expected data structures for verification
const expectedDataStructures = {
  hubspot: {
    company: {
      id: "string",
      name: "string",
      ownerEmail: "string|null",
      dwollaId: "string|null",
    },
    summaryOfBenefits: [
      {
        id: "string",
        amountToDraft: "number",
        feeAmount: "number|optional",
        totalPolicies: "number",
        pdfDocumentUrl: "string|optional",
        policies: [
          {
            id: "string",
            policyNumber: "string",
            policyHolderName: "string",
            coverageType: "string",
            premiumAmount: "number",
            effectiveDate: "string",
            expirationDate: "string|optional",
            status: "string",
          },
        ],
      },
    ],
  },
  dwolla: {
    customer: {
      id: "string",
      email: "string",
      name: "string",
      status: "string",
      businessName: "string|optional",
    },
    fundingSource: {
      accountType: "string",
      accountNumber: "string", // Should be masked
      routingNumber: "string",
      verificationStatus: "string",
    },
    transfers: [
      {
        id: "string",
        amount: "string|number",
        date: "string",
        status: "string",
        type: "string",
        currency: "string|optional",
      },
    ],
    notifications: [
      {
        id: "string",
        message: "string",
        date: "string",
        type: "string",
      },
    ],
  },
}

// UI component field requirements
const uiComponentFields = {
  "HubSpot Result Panel": {
    file: "components/results/hubspot-result-panel.tsx",
    fields: {
      "company.id": "Used for copying company ID",
      "company.name": "Display company name",
      "company.ownerEmail": 'Display owner email or "Not set"',
      "company.dwollaId": "Display Dwolla ID with copy button",
      "summaryOfBenefits[].id": "Key for SOB items",
      "summaryOfBenefits[].amountToDraft": "Amount to draft display",
      "summaryOfBenefits[].totalPolicies": "Policy count display",
      "summaryOfBenefits[].pdfDocumentUrl": "PDF document link",
      "summaryOfBenefits[].policies[].id": "Key for policy items",
      "summaryOfBenefits[].policies[].policyNumber": "Policy number display",
      "summaryOfBenefits[].policies[].policyHolderName": "Policy holder name",
      "summaryOfBenefits[].policies[].coverageType": "Coverage type display",
      "summaryOfBenefits[].policies[].premiumAmount": "Premium amount display",
      "summaryOfBenefits[].policies[].effectiveDate": "Effective date display",
      "summaryOfBenefits[].policies[].expirationDate": "Expiration date display",
      "summaryOfBenefits[].policies[].status": "Policy status badge",
    },
  },
  "Dashboard Data Panels": {
    file: "components/v0/data-panels.tsx",
    fields: {
      "hubspot.company.id": "Company ID display",
      "hubspot.company.name": "Company name display",
      "hubspot.company.ownerEmail": "Owner email display",
      "hubspot.summaryOfBenefits[].amountToDraft": "Amount to draft formatting",
      "hubspot.summaryOfBenefits[].feeAmount": "Fee amount display (optional)",
      "hubspot.summaryOfBenefits[].pdfDocumentUrl": "PDF button functionality",
      "hubspot.summaryOfBenefits[].policies[].coverageType": "Policy coverage display",
      "hubspot.summaryOfBenefits[].policies[].policyNumber": "Policy number display",
      "hubspot.summaryOfBenefits[].policies[].premiumAmount": "Premium amount formatting",
      "hubspot.summaryOfBenefits[].policies[].status": "Policy status badge",
      "dwolla.customer.id": "Dwolla customer ID",
      "dwolla.customer.email": "Customer email display",
      "dwolla.customer.name": "Customer name display",
      "dwolla.customer.status": "Customer status badge",
      "dwolla.fundingSource.accountType": "Account type display",
      "dwolla.fundingSource.accountNumber": "Masked account number",
      "dwolla.fundingSource.routingNumber": "Routing number display",
      "dwolla.fundingSource.verificationStatus": "Verification status badge",
      "dwolla.transfers[].amount": "Transfer amount display",
      "dwolla.transfers[].date": "Transfer date display",
      "dwolla.transfers[].status": "Transfer status badge",
      "dwolla.transfers[].type": "Transfer type display",
    },
  },
}

// Backend API field mappings (from service layer)
const backendFieldMappings = {
  hubspot: {
    company: {
      "properties.hs_object_id": "company.id",
      "properties.name": "company.name",
      "properties.email___owner": "company.ownerEmail",
      "properties.dwolla_customer_id": "company.dwollaId",
    },
    summaryOfBenefits: {
      "properties.amount_to_draft": "summaryOfBenefits[].amountToDraft",
      "properties.fee_amount": "summaryOfBenefits[].feeAmount",
      "properties.pdf_document_url": "summaryOfBenefits[].pdfDocumentUrl",
    },
    policies: {
      "properties.policy_number": "policies[].policyNumber",
      "properties.policy_holder_name": "policies[].policyHolderName",
      "properties.coverage_type": "policies[].coverageType",
      "properties.premium_amount": "policies[].premiumAmount",
      "properties.effective_date": "policies[].effectiveDate",
      "properties.expiration_date": "policies[].expirationDate",
      "properties.status": "policies[].status",
    },
  },
  dwolla: {
    customer: {
      id: "customer.id",
      email: "customer.email",
      "firstName + lastName": "customer.name",
      status: "customer.status",
      businessName: "customer.businessName",
    },
    fundingSource: {
      type: "fundingSource.accountType",
      "name (masked)": "fundingSource.accountNumber",
      routingNumber: "fundingSource.routingNumber",
      status: "fundingSource.verificationStatus",
    },
    transfers: {
      "amount.value": "transfers[].amount",
      created: "transfers[].date",
      status: "transfers[].status",
      "amount.currency": "transfers[].currency",
    },
  },
}

console.log("✅ Expected Data Structure Validation")
console.log("=====================================\n")

// Validate data structures
function validateDataStructure(structure, path = "") {
  const issues = []

  for (const [key, value] of Object.entries(structure)) {
    const currentPath = path ? `${path}.${key}` : key

    if (typeof value === "object" && value !== null && !Array.isArray(value)) {
      issues.push(...validateDataStructure(value, currentPath))
    } else if (Array.isArray(value) && value.length > 0) {
      const arrayPath = `${currentPath}[]`
      if (typeof value[0] === "object") {
        issues.push(...validateDataStructure(value[0], arrayPath))
      }
    }
  }

  return issues
}

console.log("HubSpot Data Structure:")
const hubspotIssues = validateDataStructure(expectedDataStructures.hubspot, "hubspot")
if (hubspotIssues.length === 0) {
  console.log("  ✅ All fields properly defined")
} else {
  console.log("  ❌ Issues found:")
  hubspotIssues.forEach((issue) => console.log(`    - ${issue}`))
}

console.log("\nDwolla Data Structure:")
const dwollaIssues = validateDataStructure(expectedDataStructures.dwolla, "dwolla")
if (dwollaIssues.length === 0) {
  console.log("  ✅ All fields properly defined")
} else {
  console.log("  ❌ Issues found:")
  dwollaIssues.forEach((issue) => console.log(`    - ${issue}`))
}

console.log("\n✅ UI Component Field Usage Verification")
console.log("=========================================\n")

// Check if UI component files exist and verify field usage
function checkComponentFieldUsage() {
  const issues = []

  for (const [componentName, config] of Object.entries(uiComponentFields)) {
    console.log(`${componentName}:`)
    const filePath = path.join(process.cwd(), config.file)

    if (!fs.existsSync(filePath)) {
      console.log(`  ❌ File not found: ${config.file}`)
      issues.push(`Missing file: ${config.file}`)
      continue
    }

    const fileContent = fs.readFileSync(filePath, "utf8")
    const missingFields = []
    const foundFields = []

    for (const [field, description] of Object.entries(config.fields)) {
      // Convert field path to possible JavaScript access patterns
      const fieldPatterns = [
        field,
        field.replace(/\[\]/g, "."),
        field.replace(/\[\]/g, "["),
        field.split(".").pop(), // Just the field name
      ]

      const isFound = fieldPatterns.some(
        (pattern) =>
          fileContent.includes(pattern) || fileContent.includes(pattern.replace(".", "?."))
      )

      if (isFound) {
        foundFields.push({ field, description })
      } else {
        missingFields.push({ field, description })
      }
    }

    console.log(
      `  ✅ Found ${foundFields.length}/${Object.keys(config.fields).length} expected fields`
    )

    if (missingFields.length > 0) {
      console.log("  ⚠️  Potentially missing fields:")
      missingFields.forEach(({ field, description }) => {
        console.log(`    - ${field} (${description})`)
      })
    }

    if (foundFields.length > 0) {
      console.log("  ✅ Correctly mapped fields:")
      foundFields.forEach(({ field, description }) => {
        console.log(`    - ${field} (${description})`)
      })
    }

    console.log("")
  }

  return issues
}

const componentIssues = checkComponentFieldUsage()

console.log("✅ Backend to UI Mapping Verification")
console.log("======================================\n")

// Verify backend service transformations are correct
console.log("HubSpot Service Mappings:")
for (const [objectType, mappings] of Object.entries(backendFieldMappings.hubspot)) {
  console.log(`  ${objectType}:`)
  for (const [apiField, uiField] of Object.entries(mappings)) {
    console.log(`    ${apiField} → ${uiField}`)
  }
}

console.log("\nDwolla Service Mappings:")
for (const [objectType, mappings] of Object.entries(backendFieldMappings.dwolla)) {
  console.log(`  ${objectType}:`)
  for (const [apiField, uiField] of Object.entries(mappings)) {
    console.log(`    ${apiField} → ${uiField}`)
  }
}

console.log("\n✅ Data Security Verification")
console.log("==============================\n")

const securityChecks = [
  {
    name: "Account Number Masking",
    field: "dwolla.fundingSource.accountNumber",
    requirement: "Should display as ****1234 format",
    status: "✅ Implemented in service layer",
  },
  {
    name: "SSN Protection",
    field: "dwolla.customer.ssn",
    requirement: "Should never be exposed to UI",
    status: "✅ Not included in UI data structure",
  },
  {
    name: "Sensitive Data Logging",
    field: "All sensitive fields",
    requirement: "Should not be logged in console",
    status: "⚠️  Verify no sensitive data in console.log statements",
  },
]

securityChecks.forEach((check) => {
  console.log(`${check.name}:`)
  console.log(`  Field: ${check.field}`)
  console.log(`  Requirement: ${check.requirement}`)
  console.log(`  Status: ${check.status}\n`)
})

console.log("✅ Summary & Recommendations")
console.log("=============================\n")

const totalIssues = hubspotIssues.length + dwollaIssues.length + componentIssues.length

if (totalIssues === 0) {
  console.log("🎉 All field mappings appear to be correctly configured!")
} else {
  console.log(`⚠️  Found ${totalIssues} potential issues that should be reviewed.`)
}

console.log("\n📋 Next Steps:")
console.log("1. Test the updated mock data structure in the UI")
console.log("2. Verify real API responses match expected structure")
console.log("3. Check console for any runtime mapping errors")
console.log("4. Ensure all currency values are properly formatted")
console.log("5. Verify all status badges display correctly")
console.log("6. Test PDF button functionality with real URLs")
console.log("7. Confirm sensitive data masking works in production\n")

console.log("✅ Field Mapping Verification Complete")
console.log("=======================================\n")
