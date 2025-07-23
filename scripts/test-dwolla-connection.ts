#!/usr/bin/env tsx
// Test script to verify Dwolla API connection
// Run with: npm run tsx scripts/test-dwolla-connection.ts

import { DwollaClient } from '../lib/api/dwolla/client';
import { ACHTransactionSync } from '../lib/api/dwolla/ach-sync';

async function testDwollaConnection() {
  console.log('Testing Dwolla API connection...\n');
  
  try {
    // Create Dwolla client
    const client = new DwollaClient();
    
    // Test 1: Try to fetch transfers
    console.log('1. Testing transfer fetch...');
    try {
      const transfers = await client.getTransfers({ limit: 5 });
      console.log(`✓ Successfully fetched transfers. Found ${transfers._embedded?.transfers?.length || 0} transfers`);
      
      if (transfers._embedded?.transfers?.length > 0) {
        console.log(`   First transfer ID: ${transfers._embedded.transfers[0].id}`);
      }
    } catch (error) {
      console.error('✗ Failed to fetch transfers:', error.message);
    }
    
    // Test 2: Test ACH sync service
    console.log('\n2. Testing ACH sync service...');
    const syncService = new ACHTransactionSync(client);
    
    try {
      const results = await syncService.syncTransactions({ limit: 5 });
      console.log(`✓ Sync completed. Synced: ${results.synced}, Failed: ${results.failed}`);
      
      if (results.errors.length > 0) {
        console.log('   Errors encountered:');
        results.errors.forEach(err => console.log(`   - ${err}`));
      }
    } catch (error) {
      console.error('✗ Sync failed:', error.message);
    }
    
    console.log('\nDwolla connection test completed!');
    
  } catch (error) {
    console.error('Fatal error during testing:', error);
    process.exit(1);
  }
}

// Run the test
testDwollaConnection().catch(console.error);