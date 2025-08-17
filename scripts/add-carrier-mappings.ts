import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function addCarrierMappings() {
  try {
    console.log('Adding carrier mappings...')

    // Add mapping for Health Cost Sharing to Sedera
    const sedera = await prisma.carrierMapping.upsert({
      where: {
        productName: 'Health Cost Sharing'
      },
      update: {
        carrierName: 'Sedera',
        carrierCode: 'SEDERA',
        isActive: true,
        updatedAt: new Date()
      },
      create: {
        productName: 'Health Cost Sharing',
        productCode: 'HCS',
        carrierName: 'Sedera',
        carrierCode: 'SEDERA',
        isActive: true
      }
    })
    console.log('Added/Updated mapping: Health Cost Sharing → Sedera')

    // Add mapping for Sontiq ID Security - Individual to Transunion
    const transunion = await prisma.carrierMapping.upsert({
      where: {
        productName: 'Sontiq ID Security - Individual'
      },
      update: {
        carrierName: 'Transunion',
        carrierCode: 'TRANSUNION',
        isActive: true,
        updatedAt: new Date()
      },
      create: {
        productName: 'Sontiq ID Security - Individual',
        productCode: 'SONTIQ-IND',
        carrierName: 'Transunion',
        carrierCode: 'TRANSUNION',
        isActive: true
      }
    })
    console.log('Added/Updated mapping: Sontiq ID Security - Individual → Transunion')

    // List all active mappings
    console.log('\n=== All Active Carrier Mappings ===')
    const allMappings = await prisma.carrierMapping.findMany({
      where: { isActive: true },
      orderBy: { carrierName: 'asc' }
    })

    // Group by carrier
    const byCarrier = allMappings.reduce((acc, mapping) => {
      if (!acc[mapping.carrierName]) {
        acc[mapping.carrierName] = []
      }
      acc[mapping.carrierName].push(mapping.productName)
      return acc
    }, {} as Record<string, string[]>)

    for (const [carrier, products] of Object.entries(byCarrier)) {
      console.log(`\n${carrier}:`)
      products.forEach(product => console.log(`  - ${product}`))
    }

    console.log('\n✅ Carrier mappings added successfully!')
  } catch (error) {
    console.error('Error adding carrier mappings:', error)
  } finally {
    await prisma.$disconnect()
  }
}

addCarrierMappings()