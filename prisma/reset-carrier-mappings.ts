import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()

async function resetCarrierMappings() {
  console.log("🗑️  Clearing existing carrier mappings...")
  
  try {
    // Delete all existing mappings
    const deleteResult = await prisma.carrierMapping.deleteMany()
    console.log(`✅ Deleted ${deleteResult.count} existing mappings`)
    
    console.log("✅ Carrier mappings cleared successfully!")
    console.log("Run 'npm run seed:carriers' to add the new mappings")
  } catch (error) {
    console.error("❌ Error clearing carrier mappings:", error)
  } finally {
    await prisma.$disconnect()
  }
}

resetCarrierMappings()