import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()

// Default carrier mappings based on common insurance products
const defaultCarrierMappings = [
  // Dental
  { productName: "Dental", carrierName: "Delta Dental", productCode: "DENT-001" },
  { productName: "Dental Enhanced", carrierName: "Delta Dental", productCode: "DENT-002" },
  { productName: "Dental Basic", carrierName: "Delta Dental", productCode: "DENT-003" },
  
  // Vision
  { productName: "Vision", carrierName: "VSP", productCode: "VIS-001" },
  { productName: "Vision Plus", carrierName: "VSP", productCode: "VIS-002" },
  { productName: "Vision Standard", carrierName: "VSP", productCode: "VIS-003" },
  
  // Health Insurance
  { productName: "Health Insurance", carrierName: "Anthem", productCode: "HLTH-001" },
  { productName: "Health PPO", carrierName: "Anthem", productCode: "HLTH-002" },
  { productName: "Health HMO", carrierName: "Anthem", productCode: "HLTH-003" },
  { productName: "Health HDHP", carrierName: "Anthem", productCode: "HLTH-004" },
  
  // Life Insurance
  { productName: "Life Insurance", carrierName: "MetLife", productCode: "LIFE-001" },
  { productName: "Term Life", carrierName: "MetLife", productCode: "LIFE-002" },
  { productName: "Whole Life", carrierName: "MetLife", productCode: "LIFE-003" },
  { productName: "Life Insurance 100K", carrierName: "MetLife", productCode: "LIFE-100" },
  { productName: "Life Insurance 250K", carrierName: "MetLife", productCode: "LIFE-250" },
  { productName: "Life Insurance 500K", carrierName: "MetLife", productCode: "LIFE-500" },
  
  // Disability
  { productName: "Short Term Disability", carrierName: "The Hartford", productCode: "STD-001" },
  { productName: "Long Term Disability", carrierName: "The Hartford", productCode: "LTD-001" },
  { productName: "STD", carrierName: "The Hartford", productCode: "STD-002" },
  { productName: "LTD", carrierName: "The Hartford", productCode: "LTD-002" },
  
  // Accident Insurance
  { productName: "Accident Insurance", carrierName: "Aflac", productCode: "ACC-001" },
  { productName: "Accident", carrierName: "Aflac", productCode: "ACC-002" },
  
  // Critical Illness
  { productName: "Critical Illness", carrierName: "Aflac", productCode: "CI-001" },
  { productName: "Critical Illness Insurance", carrierName: "Aflac", productCode: "CI-002" },
  
  // Hospital Indemnity
  { productName: "Hospital Indemnity", carrierName: "Aflac", productCode: "HI-001" },
  { productName: "Hospital Insurance", carrierName: "Aflac", productCode: "HI-002" },
  
  // FSA/HSA
  { productName: "FSA", carrierName: "WageWorks", productCode: "FSA-001" },
  { productName: "HSA", carrierName: "WageWorks", productCode: "HSA-001" },
  { productName: "Flexible Spending Account", carrierName: "WageWorks", productCode: "FSA-002" },
  { productName: "Health Savings Account", carrierName: "WageWorks", productCode: "HSA-002" },
  
  // Pet Insurance
  { productName: "Pet Insurance", carrierName: "Nationwide", productCode: "PET-001" },
  { productName: "Pet Coverage", carrierName: "Nationwide", productCode: "PET-002" },
  
  // Legal Services
  { productName: "Legal Services", carrierName: "MetLife Legal", productCode: "LEG-001" },
  { productName: "Legal Plan", carrierName: "MetLife Legal", productCode: "LEG-002" },
  
  // Identity Protection
  { productName: "Identity Protection", carrierName: "AllState", productCode: "ID-001" },
  { productName: "ID Theft Protection", carrierName: "AllState", productCode: "ID-002" },
]

async function seedCarrierMappings() {
  console.log("🌱 Seeding carrier mappings...")

  let created = 0
  let skipped = 0

  for (const mapping of defaultCarrierMappings) {
    try {
      // Check if mapping already exists
      const existing = await prisma.carrierMapping.findUnique({
        where: { productName: mapping.productName }
      })

      if (existing) {
        console.log(`⏭️  Skipped: ${mapping.productName} (already exists)`)
        skipped++
      } else {
        await prisma.carrierMapping.create({
          data: {
            ...mapping,
            isActive: true,
          }
        })
        console.log(`✅ Created: ${mapping.productName} → ${mapping.carrierName}`)
        created++
      }
    } catch (error) {
      console.error(`❌ Error creating mapping for ${mapping.productName}:`, error)
    }
  }

  console.log(`
📊 Seeding Summary:
   Created: ${created} mappings
   Skipped: ${skipped} mappings
   Total:   ${defaultCarrierMappings.length} mappings
  `)
}

// Run the seed function
seedCarrierMappings()
  .catch((error) => {
    console.error("Error seeding carrier mappings:", error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })