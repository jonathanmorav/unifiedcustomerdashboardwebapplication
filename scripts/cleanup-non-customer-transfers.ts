import { prisma } from '../lib/db';

async function cleanupNonCustomerTransfers() {
  try {
    console.log('\n=== Cleaning Up Non-Customer Transfers ===\n');
    
    // Get current counts
    const totalBefore = await prisma.aCHTransaction.count();
    const customerBefore = await prisma.aCHTransaction.count({
      where: {
        customerEmail: { not: null }
      }
    });
    
    console.log(`Before cleanup:`);
    console.log(`- Total transfers: ${totalBefore}`);
    console.log(`- Customer transfers: ${customerBefore}`);
    console.log(`- Non-customer transfers: ${totalBefore - customerBefore}`);
    
    // Delete all transfers without customer email (bank transfers)
    const deleteResult = await prisma.aCHTransaction.deleteMany({
      where: {
        customerEmail: null
      }
    });
    
    console.log(`\nDeleted ${deleteResult.count} non-customer transfers`);
    
    // Get final count
    const totalAfter = await prisma.aCHTransaction.count();
    console.log(`\nAfter cleanup: ${totalAfter} customer-initiated transfers remain`);
    
    // Show sample of remaining transfers
    const sampleTransfers = await prisma.aCHTransaction.findMany({
      take: 5,
      orderBy: { created: 'desc' },
      select: {
        customerName: true,
        customerEmail: true,
        companyName: true,
        amount: true,
        status: true,
      }
    });
    
    console.log('\n=== Sample Customer Transfers ===');
    sampleTransfers.forEach((tx, i) => {
      console.log(`\n${i + 1}. ${tx.customerName} (${tx.customerEmail})`);
      console.log(`   Company: ${tx.companyName || 'N/A'}`);
      console.log(`   Amount: $${tx.amount}`);
      console.log(`   Status: ${tx.status}`);
    });
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

cleanupNonCustomerTransfers();