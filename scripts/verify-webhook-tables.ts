#!/usr/bin/env tsx

import { prisma } from "@/lib/db"

async function verifyTables() {
  console.log("🔍 Verifying webhook analytics tables...\n")

  try {
    // Check each table by attempting a count query
    const tables = [
      { name: "WebhookEvent", model: prisma.webhookEvent },
      { name: "JourneyInstance", model: prisma.journeyInstance },
      { name: "JourneyStep", model: prisma.journeyStep },
      { name: "EventJourneyDefinition", model: prisma.eventJourneyDefinition },
      { name: "ReconciliationCheck", model: prisma.reconciliationCheck },
      { name: "ReconciliationDiscrepancy", model: prisma.reconciliationDiscrepancy },
      { name: "EventMetric", model: prisma.eventMetric },
      { name: "EventAnomaly", model: prisma.eventAnomaly },
      { name: "AlertRule", model: prisma.alertRule },
      { name: "AlertInstance", model: prisma.alertInstance },
      { name: "SystemHealth", model: prisma.systemHealth },
      { name: "ReconciliationJob", model: prisma.reconciliationJob },
    ]

    for (const { name, model } of tables) {
      try {
        const count = await (model as any).count()
        console.log(`✅ ${name}: ${count} records`)
      } catch (error) {
        console.log(`❌ ${name}: Table not found or error`)
      }
    }

    console.log("\n✨ Verification complete!")
  } catch (error) {
    console.error("Error verifying tables:", error)
  } finally {
    await prisma.$disconnect()
  }
}

verifyTables()