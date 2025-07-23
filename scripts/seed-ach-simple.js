const { PrismaClient } = require('../lib/generated/prisma');

const prisma = new PrismaClient();

const statuses = ['pending', 'processing', 'completed', 'failed', 'cancelled', 'returned'];
const directions = ['credit', 'debit'];
const companies = ['Acme Corp', 'TechStart Inc', 'Global Solutions', 'Prime Services', 'Digital Dynamics'];
const names = ['John Smith', 'Jane Doe', 'Robert Johnson', 'Maria Garcia', 'David Lee'];

async function generateMockTransactions(count = 100) {
  const transactions = [];
  const now = new Date();
  
  for (let i = 0; i < count; i++) {
    const status = statuses[Math.floor(Math.random() * statuses.length)];
    const direction = directions[Math.floor(Math.random() * directions.length)];
    const amount = parseFloat((Math.random() * 5000 + 100).toFixed(2));
    const created = new Date(now);
    created.setDate(created.getDate() - Math.floor(Math.random() * 90));
    
    const transaction = {
      dwollaId: `dwolla_${Math.random().toString(36).substr(2, 9)}`,
      status,
      amount,
      currency: 'USD',
      direction,
      created: created,
      sourceName: direction === 'debit' ? names[Math.floor(Math.random() * names.length)] : 'Company Account',
      destinationName: direction === 'credit' ? names[Math.floor(Math.random() * names.length)] : 'Company Account',
      bankLastFour: Math.floor(Math.random() * 9000 + 1000).toString(),
      correlationId: `cor_${Math.random().toString(36).substr(2, 9)}`,
      individualAchId: `ach_${Math.random().toString(36).substr(2, 9)}`,
      customerName: names[Math.floor(Math.random() * names.length)],
      customerEmail: `${names[Math.floor(Math.random() * names.length)].toLowerCase().replace(' ', '.')}@example.com`,
      companyName: companies[Math.floor(Math.random() * companies.length)],
      invoiceNumber: `INV-${Math.floor(Math.random() * 9000 + 1000)}`,
      transactionType: direction === 'credit' ? 'payment' : 'invoice',
      description: `${direction === 'credit' ? 'Payment' : 'Invoice'} for services`,
      fees: status === 'completed' ? parseFloat((amount * 0.0029).toFixed(2)) : 0,
      netAmount: status === 'completed' ? amount - parseFloat((amount * 0.0029).toFixed(2)) : amount,
      clearingDate: status === 'completed' ? new Date(created.getTime() + 86400000 * 3) : null,
      processedAt: status === 'completed' ? new Date(created) : null,
      metadata: {
        source: 'demo',
        generatedAt: new Date().toISOString(),
      },
    };
    
    transactions.push(transaction);
  }
  
  return transactions;
}

async function seedACHTransactions() {
  console.log('🌱 Starting ACH transaction seeding...');

  try {
    // Check if we already have transactions
    const existingCount = await prisma.aCHTransaction.count();
    
    if (existingCount > 0) {
      console.log(`✅ Database already contains ${existingCount} ACH transactions.`);
      const forceFlag = process.argv.includes('--force');
      
      if (!forceFlag) {
        console.log('Use --force flag to add more transactions.');
        return;
      }
    }

    // Generate mock transactions
    console.log('📥 Generating mock ACH transactions...');
    const mockTransactions = await generateMockTransactions(100);
    
    // Insert transactions
    let successCount = 0;
    let failCount = 0;
    
    for (const transaction of mockTransactions) {
      try {
        await prisma.aCHTransaction.create({
          data: transaction
        });
        successCount++;
      } catch (error) {
        failCount++;
        console.error(`Failed to insert transaction: ${error.message}`);
      }
    }

    console.log(`✅ Successfully created ${successCount} transactions`);
    if (failCount > 0) {
      console.log(`⚠️  Failed to create ${failCount} transactions`);
    }

    // Show some statistics
    const stats = await prisma.aCHTransaction.groupBy({
      by: ['status'],
      _count: {
        _all: true,
      },
    });

    console.log('\n📊 Transaction Statistics:');
    stats.forEach(stat => {
      console.log(`  ${stat.status}: ${stat._count._all} transactions`);
    });

    const totalAmount = await prisma.aCHTransaction.aggregate({
      _sum: {
        amount: true,
      },
    });

    console.log(`\n💰 Total transaction volume: $${totalAmount._sum.amount?.toFixed(2) || '0.00'}`);

  } catch (error) {
    console.error('❌ Error seeding ACH transactions:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }

  console.log('\n🎉 ACH transaction seeding completed!');
}

// Run the seed function
seedACHTransactions().catch((error) => {
  console.error('Unexpected error:', error);
  process.exit(1);
});