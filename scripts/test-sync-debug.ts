import { DwollaClient } from '../lib/api/dwolla/client';
import { ACHTransactionSync } from '../lib/api/dwolla/ach-sync';

// Load environment variables
import dotenv from 'dotenv';
import path from 'path';

// Load .env.local
dotenv.config({ path: path.join(process.cwd(), '.env.local') });

async function testSync() {
  try {
    console.log('\n=== Testing ACH Sync with Debug Logging ===\n');

    // Create Dwolla client
    const dwollaClient = new DwollaClient();
    const syncService = new ACHTransactionSync(dwollaClient);

    // Perform sync with small limit
    console.log('Starting sync with limit of 3 transactions...\n');
    const results = await syncService.syncTransactions({ limit: 3 });

    console.log('\n=== Sync Results ===');
    console.log(`Synced: ${results.synced}`);
    console.log(`Failed: ${results.failed}`);
    if (results.errors.length > 0) {
      console.log('Errors:', results.errors);
    }

  } catch (error) {
    console.error('Sync test failed:', error);
  }
}

testSync();