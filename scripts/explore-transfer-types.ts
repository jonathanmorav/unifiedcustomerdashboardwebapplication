import { DwollaClient } from '../lib/api/dwolla/client';
import dotenv from 'dotenv';
import path from 'path';

// Load .env.local
dotenv.config({ path: path.join(process.cwd(), '.env.local') });

async function exploreTransfers() {
  try {
    const client = new DwollaClient();
    const accountId = process.env.DWOLLA_MASTER_ACCOUNT_ID;
    
    console.log('\n=== Exploring Different Transfer Types ===\n');
    console.log(`Master Account ID: ${accountId}\n`);

    // Get recent transfers
    const response = await client.getTransfers({ limit: 10 });
    const transfers = response._embedded?.transfers || [];
    
    console.log(`Found ${transfers.length} transfers\n`);

    // Analyze each transfer
    for (let i = 0; i < Math.min(5, transfers.length); i++) {
      const transfer = transfers[i];
      console.log(`\n--- Transfer ${i + 1} ---`);
      console.log(`ID: ${transfer.id}`);
      console.log(`Amount: $${transfer.amount.value}`);
      console.log(`Status: ${transfer.status}`);
      console.log(`Created: ${transfer.created}`);
      
      // Check source type
      const sourceHref = transfer._links.source.href;
      console.log(`\nSource URL: ${sourceHref}`);
      
      if (sourceHref.includes('/funding-sources/')) {
        console.log('Source Type: Funding Source');
        try {
          const source = await client.getFundingSourceByUrl(sourceHref);
          console.log(`Source Name: ${source.name}`);
          console.log(`Source Type: ${source.type}`);
          
          // Check if this funding source belongs to a customer
          if (source._links?.customer) {
            console.log('>>> This is a CUSTOMER funding source!');
            const customer = await client.getCustomerByUrl(source._links.customer.href);
            console.log(`Customer: ${customer.firstName} ${customer.lastName}`);
            console.log(`Customer Email: ${customer.email}`);
            console.log(`Customer Type: ${customer.type}`);
          }
        } catch (error) {
          console.log('Error fetching source:', error.message);
        }
      } else if (sourceHref.includes('/accounts/')) {
        console.log('Source Type: Master Account');
      }
      
      // Check destination type
      const destHref = transfer._links.destination.href;
      console.log(`\nDestination URL: ${destHref}`);
      
      if (destHref.includes('/funding-sources/')) {
        console.log('Destination Type: Funding Source');
        try {
          const dest = await client.getFundingSourceByUrl(destHref);
          console.log(`Destination Name: ${dest.name}`);
          console.log(`Destination Type: ${dest.type}`);
          
          // Check if this funding source belongs to a customer
          if (dest._links?.customer) {
            console.log('>>> This is a CUSTOMER funding source!');
            const customer = await client.getCustomerByUrl(dest._links.customer.href);
            console.log(`Customer: ${customer.firstName} ${customer.lastName}`);
            console.log(`Customer Email: ${customer.email}`);
            console.log(`Customer Type: ${customer.type}`);
          }
        } catch (error) {
          console.log('Error fetching destination:', error.message);
        }
      } else if (destHref.includes('/accounts/')) {
        console.log('Destination Type: Master Account');
      }
      
      console.log('\n' + '='.repeat(50));
    }

    // Try to find customer-initiated transfers
    console.log('\n\n=== Looking for Customer-Initiated Transfers ===\n');
    
    // Get more transfers to find customer ones
    const moreTransfers = await client.getTransfers({ limit: 100 });
    const allTransfers = moreTransfers._embedded?.transfers || [];
    
    let customerTransferCount = 0;
    for (const transfer of allTransfers) {
      // Check if source is a funding source (not account)
      if (transfer._links.source.href.includes('/funding-sources/')) {
        try {
          const source = await client.getFundingSourceByUrl(transfer._links.source.href);
          if (source._links?.customer) {
            customerTransferCount++;
            if (customerTransferCount <= 3) {
              console.log(`\nFound customer transfer: ${transfer.id}`);
              console.log(`Amount: $${transfer.amount.value}`);
              console.log(`Source: ${source.name}`);
              const customer = await client.getCustomerByUrl(source._links.customer.href);
              console.log(`Customer: ${customer.firstName} ${customer.lastName} (${customer.email})`);
            }
          }
        } catch (error) {
          // Skip errors
        }
      }
    }
    
    console.log(`\nTotal customer-initiated transfers found: ${customerTransferCount} out of ${allTransfers.length}`);

  } catch (error) {
    console.error('Exploration failed:', error);
  }
}

exploreTransfers();