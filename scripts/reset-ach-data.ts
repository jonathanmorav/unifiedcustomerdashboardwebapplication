import { prisma } from '../lib/db';

async function resetACHData() {
  try {
    console.log('Deleting all ACH transactions with mock data...');
    
    // Delete all transactions (to remove mock data)
    const result = await prisma.aCHTransaction.deleteMany({});
    
    console.log(`Deleted ${result.count} transactions`);
    console.log('Database is now clean and ready for fresh sync');
    
  } catch (error) {
    console.error('Error resetting ACH data:', error);
  } finally {
    await prisma.$disconnect();
  }
}

resetACHData();