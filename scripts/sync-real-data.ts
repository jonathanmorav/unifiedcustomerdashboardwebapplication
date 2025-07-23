import { DwollaClient } from '../lib/api/dwolla/client';
import { ACHTransactionSync } from '../lib/api/dwolla/ach-sync';
import dotenv from 'dotenv';
import path from 'path';

// Load .env.local
dotenv.config({ path: path.join(process.cwd(), '.env.local') });

async function syncRealData() {
  try {
    console.log('\n=== Syncing Real Customer Data ===\n');

    // Create Dwolla client
    const dwollaClient = new DwollaClient();
    const syncService = new ACHTransactionSync(dwollaClient);

    // Perform sync with higher limit to get more customer transfers
    console.log('Starting sync with limit of 100 transactions...\n');
    const results = await syncService.syncTransactions({ limit: 100 });

    console.log('\n=== Sync Results ===');
    console.log(`Synced: ${results.synced}`);
    console.log(`Failed: ${results.failed}`);
    if (results.errors.length > 0) {
      console.log('Errors:', results.errors);
    }

    console.log('\nSync completed successfully!');
    console.log('You can now check the billing page to see real customer data.');

  } catch (error) {
    console.error('Sync failed:', error);
  }
}

syncRealData();