/*
  Refresh ACH transaction statuses by querying Dwolla for all records currently marked
  as "pending" or "processing", and updating them in our database.

  Usage:
    - npx tsx scripts/refresh-pending-statuses.ts
    - npx tsx scripts/refresh-pending-statuses.ts --olderThanDays 1 --concurrency 5

  Notes:
    - Respects rate limits using the built-in Dwolla client backoff.
    - Skips when DEMO_MODE is true or Dwolla credentials are not configured.
*/

import { prisma } from "@/lib/db"
import { DwollaClient, DwollaAPIError } from "@/lib/api/dwolla/client"

interface Args {
  olderThanDays?: number
  concurrency?: number
}

function parseArgs(argv: string[]): Args {
  const args: Args = {}
  for (let i = 2; i < argv.length; i++) {
    const [key, val] = argv[i].split("=")
    if (key === "--olderThanDays") args.olderThanDays = val ? parseInt(val, 10) : 1
    if (key === "--concurrency") args.concurrency = val ? parseInt(val, 10) : 5
  }
  return args
}

function normalizeStatus(dwollaStatus: string): string {
  // Map any Dwolla/legacy statuses to our canonical set
  if (dwollaStatus === "completed") return "processed"
  return dwollaStatus
}

async function main() {
  const args = parseArgs(process.argv)
  const olderThanDays = args.olderThanDays ?? 0
  const concurrency = Math.max(1, args.concurrency ?? 5)

  const isDemoMode =
    process.env.DEMO_MODE === "true" ||
    !process.env.DWOLLA_KEY ||
    !process.env.DWOLLA_SECRET ||
    !process.env.DWOLLA_MASTER_ACCOUNT_ID

  if (isDemoMode) {
    console.log("Skipping refresh: DEMO_MODE active or Dwolla credentials missing")
    process.exit(0)
  }

  const client = new DwollaClient()

  // Build date filter if provided
  const createdFilter = olderThanDays > 0
    ? { lt: new Date(Date.now() - olderThanDays * 24 * 60 * 60 * 1000) }
    : undefined

  console.log("Fetching transactions to refresh...")
  const toRefresh = await prisma.aCHTransaction.findMany({
    where: {
      status: { in: ["pending", "processing"] },
      ...(createdFilter ? { created: createdFilter } : {}),
    },
    select: { id: true, dwollaId: true, status: true, created: true },
    orderBy: { created: "asc" },
    take: 10000,
  })

  console.log(`Found ${toRefresh.length} transactions to check`)
  if (toRefresh.length === 0) return

  let checked = 0
  let updated = 0
  const updatedByStatus: Record<string, number> = {}

  // Simple concurrency pool
  const queue = [...toRefresh]
  async function worker(workerId: number) {
    while (queue.length > 0) {
      const item = queue.shift()
      if (!item) break
      try {
        const transfer = await client.getTransfer(item.dwollaId)
        const newStatus = normalizeStatus(transfer.status)
        // Only update if status actually changed
        if (newStatus !== item.status) {
          await prisma.aCHTransaction.update({
            where: { dwollaId: item.dwollaId },
            data: {
              status: newStatus,
              lastUpdated: new Date(),
              processedAt: newStatus === "processed" ? new Date(transfer.created) : null,
            },
          })
          updated++
          updatedByStatus[newStatus] = (updatedByStatus[newStatus] || 0) + 1
        }
      } catch (error) {
        if (error instanceof DwollaAPIError && error.status === 404) {
          console.warn(`Dwolla transfer not found (dwollaId=${item.dwollaId}). Skipping.`)
        } else {
          console.warn(`Error refreshing ${item.dwollaId}:`, error)
        }
      } finally {
        checked++
        if (checked % 50 === 0) {
          console.log(`Progress: ${checked}/${toRefresh.length} checked, ${updated} updated`)
        }
      }
    }
  }

  await Promise.all(Array.from({ length: concurrency }, (_, i) => worker(i + 1)))

  console.log("Refresh complete:")
  console.log(`  Checked: ${checked}`)
  console.log(`  Updated: ${updated}`)
  Object.entries(updatedByStatus).forEach(([st, count]) => {
    console.log(`    ${st}: ${count}`)
  })
}

main()
  .catch((err) => {
    console.error("Fatal error in refresh script:", err)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })


