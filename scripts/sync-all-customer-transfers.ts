import { DwollaClient } from '../lib/api/dwolla/client';
import { ACHTransactionSync } from '../lib/api/dwolla/ach-sync';
import { prisma } from '../lib/db';
import dotenv from 'dotenv';
import path from 'path';

// Load .env.local
dotenv.config({ path: path.join(process.cwd(), '.env.local') });

async function syncAllCustomerTransfers() {
  try {
    console.log('\n=== Syncing All Customer Transfers ===\n');

    // First, remove all Wesbanco transfers
    console.log('Removing bank transfers...');
    const deleteResult = await prisma.aCHTransaction.deleteMany({
      where: {
        customerName: 'Wesbanco '
      }
    });
    console.log(`Removed ${deleteResult.count} bank transfers\n`);

    // Create Dwolla client
    const dwollaClient = new DwollaClient();
    const syncService = new ACHTransactionSync(dwollaClient);

    // Sync with higher limit to get all 300 customer transfers
    console.log('Starting sync to fetch all customer transfers...\n');
    const results = await syncService.syncTransactions({ limit: 500 });

    console.log('\n=== Sync Results ===');
    console.log(`Synced: ${results.synced} customer transfers`);
    console.log(`Failed: ${results.failed}`);
    if (results.errors.length > 0) {
      console.log('Errors:', results.errors);
    }

    // Verify customer transfer count
    const customerCount = await prisma.aCHTransaction.count({
      where: {
        customerEmail: { not: null }
      }
    });

    console.log(`\nTotal customer-initiated transfers in database: ${customerCount}`);
    console.log('\nSync completed successfully!');

  } catch (error) {
    console.error('Sync failed:', error);
  } finally {
    await prisma.$disconnect();
  }
}

syncAllCustomerTransfers();