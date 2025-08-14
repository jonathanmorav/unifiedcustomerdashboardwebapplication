import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()

// Actual carrier mappings from Cakewalk Benefits
const defaultCarrierMappings = [
  // Disability
  { productName: "Long Term Disability", carrierName: "SunLife", productCode: "LTD-001" },
  { productName: "Short Term Disability", carrierName: "SunLife", productCode: "STD-001" },
  
  // Life Insurance
  { productName: "Life - Dependent", carrierName: "SunLife", productCode: "LIFE-DEP-001" },
  { productName: "Voluntary Life & AD&D", carrierName: "SunLife", productCode: "VOL-LIFE-001" },
  
  // Accident & Critical Illness
  { productName: "Accident", carrierName: "SunLife", productCode: "ACC-001" },
  { productName: "Critical Illness", carrierName: "SunLife", productCode: "CI-001" },
  
  // Dental
  { productName: "Dental", carrierName: "SunLife", productCode: "DENT-001" },
  
  // Vision
  { productName: "Vision", carrierName: "Guardian", productCode: "VIS-001" },
  
  // Health
  { productName: "Health", carrierName: "Sedera", productCode: "HLTH-001" },
  { productName: "Sedera Health Cost Sharing", carrierName: "Sedera", productCode: "HLTH-002" },
  
  // Telehealth & Virtual Care
  { productName: "Telehealth", carrierName: "Recuro", productCode: "TELE-001" },
  { productName: "Virtual Primary Care", carrierName: "Recuro", productCode: "VPC-001" },
  
  // Identity Protection
  { productName: "Identity Theft Protection", carrierName: "Transunion", productCode: "ID-001" },
  
  // Long Term Care
  { productName: "Long Term Care", carrierName: "Unum", productCode: "LTC-001" },
  
  // Excess Disability
  { productName: "Excess Disability", carrierName: "Hanleigh", productCode: "EXC-DIS-001" },
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