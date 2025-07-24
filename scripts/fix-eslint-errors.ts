#!/usr/bin/env tsx

/**
 * Fix common ESLint errors to make the build pass
 */

import fs from 'fs/promises'
import path from 'path'

const fixes = [
  // Fix imports
  {
    file: 'app/analytics/webhooks/page.tsx',
    old: '  const { status } = useWebhookAnalytics()',
    replacement: '  const { } = useWebhookAnalytics()',
  },
  {
    file: 'app/analytics/webhooks/settings/page.tsx',
    old: 'import { useState } from "react"',
    replacement: '// import { useState } from "react"',
  },
  {
    file: 'app/analytics/webhooks/settings/page.tsx',
    old: 'import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"',
    replacement: '// import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"',
  },
  {
    file: 'app/analytics/webhooks/settings/page.tsx',
    old: '  const { status } = useWebhookAnalytics()',
    replacement: '  const { } = useWebhookAnalytics()',
  },
  {
    file: 'app/api/analytics/metrics/route.ts',
    old: '      const transferEvents = transfers.map((transfer) => ({',
    replacement: '      // const transferEvents = transfers.map((transfer) => ({',
  },
  {
    file: 'app/api/auth/debug/route.ts',
    old: 'export async function GET(request: Request) {',
    replacement: 'export async function GET(_request: Request) {',
  },
  {
    file: 'app/api/ach/transactions/route.ts',
    old: 'import { BusinessLogicError, SystemError } from "@/lib/errors"',
    replacement: 'import { SystemError } from "@/lib/errors"',
  },
  {
    file: 'app/api/search/route.ts',
    old: 'import { AuthError, BusinessLogicError, SystemError } from "@/lib/errors"',
    replacement: 'import { AuthError, BusinessLogicError } from "@/lib/errors"',
  },
  {
    file: 'app/api/webhooks/dwolla/sync/route.ts',
    old: '    const receiver = new WebhookReceiver()',
    replacement: '    // const receiver = new WebhookReceiver()',
  },
  {
    file: 'app/api/health/live/route.ts',
    old: '  } catch (error) {',
    replacement: '  } catch (_error) {',
  },
]

async function fixFile(filePath: string, old: string, replacement: string) {
  try {
    const fullPath = path.join(process.cwd(), filePath)
    const content = await fs.readFile(fullPath, 'utf-8')
    if (content.includes(old)) {
      const newContent = content.replace(old, replacement)
      await fs.writeFile(fullPath, newContent, 'utf-8')
      console.log(`✅ Fixed: ${filePath}`)
    } else {
      console.log(`⚠️  Pattern not found in: ${filePath}`)
    }
  } catch (error) {
    console.error(`❌ Error fixing ${filePath}:`, error)
  }
}

async function main() {
  console.log('🔧 Fixing ESLint errors...\n')
  
  for (const fix of fixes) {
    await fixFile(fix.file, fix.old, fix.replacement)
  }
  
  console.log('\n✨ Fixes applied! Run npm run build again.')
}

main()