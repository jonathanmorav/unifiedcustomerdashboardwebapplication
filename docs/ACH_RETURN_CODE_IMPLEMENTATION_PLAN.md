# ACH Return Code Capture - Implementation Plan

## Executive Summary

This document outlines a comprehensive plan to enhance ACH return code capture in the Unified Customer Dashboard without disrupting existing functionality. The implementation follows a phased approach to ensure system stability while adding robust failure tracking capabilities.

## Current System Analysis

### Existing Capabilities ✅
- **Database Ready**: `failureReason`, `failureCode`, `returnCode` fields exist in ACHTransaction model
- **UI Support**: TransactionDetailModal displays failure information
- **Export Ready**: Failure data included in CSV exports  
- **Error Handling**: Robust retry logic in DwollaClient
- **Demo Mode**: Full testing capability without live credentials

### Gaps to Address 🔧
1. Limited failure detail extraction from Dwolla API responses
2. No webhook integration for real-time updates
3. Basic return code display without detailed explanations
4. No failure analytics or trend monitoring
5. Missing proactive failure alerts

## Implementation Phases

### Phase 1: Enhanced Data Capture (Week 1)
**Goal**: Improve failure data extraction without changing existing flows

#### 1.1 Enhance ACH Sync Service
```typescript
// File: lib/api/dwolla/ach-sync.ts
// Add to existing enrichTransferData method

private async extractFailureInformation(transfer: DwollaTransfer) {
  const failureData = {
    reason: null,
    code: null,
    returnCode: null,
    details: {}
  };

  // Extract from transfer object
  if (transfer.status === 'failed' || transfer.status === 'cancelled') {
    // Check embedded failure details
    if (transfer._embedded?.['failure-details']) {
      const details = transfer._embedded['failure-details'];
      failureData.reason = details.description;
      failureData.code = details.code;
      failureData.returnCode = details.achReturnCode;
    }

    // Check transfer metadata
    if (transfer.metadata) {
      failureData.reason = failureData.reason || transfer.metadata.failureReason;
      failureData.code = failureData.code || transfer.metadata.failureCode;
      failureData.returnCode = failureData.returnCode || transfer.metadata.returnCode;
    }

    // Fetch additional details via events
    try {
      const events = await this.fetchTransferEvents(transfer.id);
      const failureEvent = events.find(e => 
        e.topic === 'transfer_failed' || 
        e.topic === 'transfer_returned'
      );
      
      if (failureEvent) {
        failureData.details = {
          eventType: failureEvent.topic,
          eventTime: failureEvent.created,
          description: failureEvent.description
        };
      }
    } catch (error) {
      console.warn('Could not fetch transfer events:', error);
    }
  }

  return failureData;
}
```

#### 1.2 Add Transfer Events Fetching
```typescript
// File: lib/api/dwolla/client.ts
// Add new method to DwollaClient

async getTransferEvents(transferId: string): Promise<any[]> {
  try {
    const response = await this.request(
      `transfers/${transferId}/events`,
      'GET'
    );
    return response._embedded?.events || [];
  } catch (error) {
    console.error('Error fetching transfer events:', error);
    return [];
  }
}
```

### Phase 2: Return Code Integration (Week 1-2)
**Goal**: Integrate comprehensive return code information

#### 2.1 Update Type Definitions
```typescript
// File: lib/types/dwolla.ts
// Add to existing types

export interface EnrichedACHTransaction extends ACHTransaction {
  returnCodeInfo?: {
    code: string;
    title: string;
    description: string;
    detailedExplanation: string;
    retryable: boolean;
    userAction: string;
    category: string;
  };
}
```

#### 2.2 Enhance Transaction API
```typescript
// File: app/api/ach/transactions/route.ts
// Add return code enrichment

import { getReturnCodeInfo } from '@/lib/api/dwolla/return-codes';

// In GET handler, after fetching transactions:
const enrichedTransactions = transactions.map(tx => ({
  ...tx,
  returnCodeInfo: tx.returnCode ? getReturnCodeInfo(tx.returnCode) : null
}));
```

### Phase 3: Webhook Integration (Week 2)
**Goal**: Real-time failure updates via webhooks

#### 3.1 Create Webhook Handler
```typescript
// File: app/api/webhooks/dwolla/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getReturnCodeInfo } from "@/lib/api/dwolla/return-codes";
import crypto from "crypto";

// Webhook signature verification
async function verifyDwollaWebhook(
  request: NextRequest, 
  payload: any
): Promise<boolean> {
  const signature = request.headers.get("X-Dwolla-Signature");
  const webhookSecret = process.env.DWOLLA_WEBHOOK_SECRET;
  
  if (!signature || !webhookSecret) return false;
  
  const computedSignature = crypto
    .createHmac("sha256", webhookSecret)
    .update(JSON.stringify(payload))
    .digest("hex");
    
  return signature === computedSignature;
}

export async function POST(request: NextRequest) {
  try {
    const payload = await request.json();
    
    // Verify webhook authenticity
    const isValid = await verifyDwollaWebhook(request, payload);
    if (!isValid) {
      return NextResponse.json(
        { error: "Invalid webhook signature" }, 
        { status: 401 }
      );
    }
    
    // Route to appropriate handler
    switch (payload.topic) {
      case "transfer_failed":
        await handleTransferFailed(payload);
        break;
      case "transfer_returned":
        await handleTransferReturned(payload);
        break;
      case "transfer_reclaimed":
        await handleTransferReclaimed(payload);
        break;
      default:
        console.log(`Unhandled webhook topic: ${payload.topic}`);
    }
    
    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("Webhook processing error:", error);
    return NextResponse.json(
      { error: "Webhook processing failed" }, 
      { status: 400 }
    );
  }
}

async function handleTransferFailed(payload: any) {
  const transferUrl = payload._links?.resource?.href;
  if (!transferUrl) return;
  
  const transferId = transferUrl.split("/").pop();
  
  // Extract failure details
  const failureReason = payload.description || "Transfer failed";
  const failureCode = payload.reasonCode || null;
  const returnCode = payload.achReturnCode || null;
  
  // Update transaction
  await prisma.aCHTransaction.update({
    where: { dwollaId: transferId },
    data: {
      status: "failed",
      failureReason,
      failureCode,
      returnCode,
      lastUpdated: new Date(),
      lastWebhookAt: new Date(),
      webhookEvents: {
        push: {
          topic: payload.topic,
          timestamp: payload.timestamp,
          details: payload
        }
      }
    }
  });
  
  // TODO: Send notification if needed
  console.log(`Transfer ${transferId} failed: ${failureReason}`);
}

async function handleTransferReturned(payload: any) {
  const transferUrl = payload._links?.resource?.href;
  if (!transferUrl) return;
  
  const transferId = transferUrl.split("/").pop();
  const returnCode = payload.returnCode || payload.achReturnCode;
  
  await prisma.aCHTransaction.update({
    where: { dwollaId: transferId },
    data: {
      status: "returned",
      returnCode,
      failureReason: getReturnCodeInfo(returnCode).title,
      failureCode: returnCode,
      lastUpdated: new Date(),
      lastWebhookAt: new Date(),
      webhookEvents: {
        push: {
          topic: payload.topic,
          timestamp: payload.timestamp,
          returnCode,
          details: payload
        }
      }
    }
  });
  
  console.log(`Transfer ${transferId} returned with code: ${returnCode}`);
}
```

#### 3.2 Database Migration
```sql
-- File: prisma/migrations/add_webhook_fields.sql
ALTER TABLE "ACHTransaction" 
ADD COLUMN "failureDetails" JSONB DEFAULT '{}',
ADD COLUMN "webhookEvents" JSONB DEFAULT '[]',
ADD COLUMN "lastWebhookAt" TIMESTAMP(3);

-- Add indexes for performance
CREATE INDEX "ACHTransaction_failureCode_idx" ON "ACHTransaction"("failureCode");
CREATE INDEX "ACHTransaction_returnCode_idx" ON "ACHTransaction"("returnCode");
CREATE INDEX "ACHTransaction_lastWebhookAt_idx" ON "ACHTransaction"("lastWebhookAt");
```

### Phase 4: Enhanced UI Components (Week 2-3)
**Goal**: Improve failure information display

#### 4.1 Enhanced Transaction Detail Modal
```typescript
// File: components/billing/TransactionDetailModal.tsx
// Add comprehensive failure display

import { getReturnCodeInfo } from "@/lib/api/dwolla/return-codes";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { InfoIcon, AlertCircle, RefreshCw } from "lucide-react";

// In the failure section:
{(transaction.failureReason || transaction.returnCode) && (
  <div className="space-y-4">
    <h3 className="mb-3 flex items-center gap-2 text-lg font-semibold text-cakewalk-error">
      <AlertCircle className="h-5 w-5" />
      Failure Information
    </h3>
    
    {transaction.returnCode && (
      <div className="rounded-lg border border-red-200 bg-red-50 p-4">
        <div className="mb-3 flex items-center justify-between">
          <Badge variant="destructive" className="text-sm">
            {transaction.returnCode}
          </Badge>
          <span className="font-semibold text-red-900">
            {getReturnCodeInfo(transaction.returnCode).title}
          </span>
        </div>
        
        <div className="space-y-3 text-sm">
          <div>
            <p className="font-medium text-gray-700">Description</p>
            <p className="text-gray-600">
              {getReturnCodeInfo(transaction.returnCode).description}
            </p>
          </div>
          
          <div>
            <p className="font-medium text-gray-700">Detailed Explanation</p>
            <p className="text-gray-600">
              {getReturnCodeInfo(transaction.returnCode).detailedExplanation}
            </p>
          </div>
          
          <div>
            <p className="font-medium text-gray-700">Common Scenarios</p>
            <ul className="ml-4 list-disc text-gray-600">
              {getReturnCodeInfo(transaction.returnCode).commonScenarios
                .slice(0, 3)
                .map((scenario, idx) => (
                  <li key={idx}>{scenario}</li>
                ))}
            </ul>
          </div>
          
          {getReturnCodeInfo(transaction.returnCode).retryable && (
            <Alert>
              <RefreshCw className="h-4 w-4" />
              <AlertDescription>
                This transaction can be retried. {getReturnCodeInfo(transaction.returnCode).retryGuidance}
              </AlertDescription>
            </Alert>
          )}
          
          <div className="mt-4 rounded-md bg-blue-50 p-3">
            <p className="flex items-start gap-2 text-sm text-blue-800">
              <InfoIcon className="mt-0.5 h-4 w-4 flex-shrink-0" />
              <span>
                <strong>Recommended Action:</strong>{" "}
                {getReturnCodeInfo(transaction.returnCode).userAction}
              </span>
            </p>
          </div>
        </div>
      </div>
    )}
  </div>
)}
```

### Phase 5: Analytics & Monitoring (Week 3)
**Goal**: Add failure analytics and monitoring

#### 5.1 Failure Analytics API
```typescript
// File: app/api/ach/analytics/failures/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getReturnCodeInfo } from "@/lib/api/dwolla/return-codes";

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");
    
    // Get failure statistics
    const failureStats = await prisma.aCHTransaction.groupBy({
      by: ["returnCode"],
      where: {
        status: { in: ["failed", "returned"] },
        createdAt: {
          gte: startDate ? new Date(startDate) : undefined,
          lte: endDate ? new Date(endDate) : undefined
        }
      },
      _count: true,
      _sum: {
        amount: true
      }
    });
    
    // Enrich with return code info
    const enrichedStats = failureStats.map(stat => ({
      returnCode: stat.returnCode,
      count: stat._count,
      totalAmount: stat._sum.amount || 0,
      info: stat.returnCode ? getReturnCodeInfo(stat.returnCode) : null
    }));
    
    // Calculate failure rate
    const totalTransactions = await prisma.aCHTransaction.count({
      where: {
        createdAt: {
          gte: startDate ? new Date(startDate) : undefined,
          lte: endDate ? new Date(endDate) : undefined
        }
      }
    });
    
    const failedTransactions = await prisma.aCHTransaction.count({
      where: {
        status: { in: ["failed", "returned"] },
        createdAt: {
          gte: startDate ? new Date(startDate) : undefined,
          lte: endDate ? new Date(endDate) : undefined
        }
      }
    });
    
    return NextResponse.json({
      summary: {
        totalTransactions,
        failedTransactions,
        failureRate: (failedTransactions / totalTransactions * 100).toFixed(2),
        topFailureReasons: enrichedStats.slice(0, 5)
      },
      details: enrichedStats
    });
  } catch (error) {
    console.error("Analytics error:", error);
    return NextResponse.json(
      { error: "Failed to fetch analytics" },
      { status: 500 }
    );
  }
}
```

#### 5.2 Failure Analytics Component
```typescript
// File: components/billing/FailureAnalytics.tsx
import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { getReturnCodeInfo, getCategoryDisplayName } from "@/lib/api/dwolla/return-codes";

export function FailureAnalytics({ dateRange }: { dateRange: any }) {
  const [analytics, setAnalytics] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    fetchAnalytics();
  }, [dateRange]);
  
  const fetchAnalytics = async () => {
    try {
      const params = new URLSearchParams({
        startDate: dateRange.from.toISOString(),
        endDate: dateRange.to.toISOString()
      });
      
      const response = await fetch(`/api/ach/analytics/failures?${params}`);
      const data = await response.json();
      setAnalytics(data);
    } finally {
      setLoading(false);
    }
  };
  
  if (loading) return <div>Loading analytics...</div>;
  if (!analytics) return null;
  
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>Failure Rate Overview</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <div className="flex justify-between">
              <span>Total Transactions</span>
              <span className="font-medium">{analytics.summary.totalTransactions}</span>
            </div>
            <div className="flex justify-between">
              <span>Failed Transactions</span>
              <span className="font-medium text-red-600">
                {analytics.summary.failedTransactions}
              </span>
            </div>
            <div className="flex justify-between">
              <span>Failure Rate</span>
              <Badge variant={
                analytics.summary.failureRate < 1 ? "success" : 
                analytics.summary.failureRate < 3 ? "warning" : "destructive"
              }>
                {analytics.summary.failureRate}%
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>
      
      <Card>
        <CardHeader>
          <CardTitle>Top Return Codes</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {analytics.summary.topFailureReasons.map((reason: any) => (
              <div key={reason.returnCode} className="space-y-1">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">{reason.returnCode}</Badge>
                    <span className="text-sm font-medium">
                      {reason.info?.title || "Unknown"}
                    </span>
                  </div>
                  <span className="text-sm text-gray-500">{reason.count}</span>
                </div>
                <div className="text-xs text-gray-500">
                  {getCategoryDisplayName(reason.info?.category)} • 
                  ${(reason.totalAmount / 100).toFixed(2)} total
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
```

## Testing Strategy

### 1. Unit Tests
```typescript
// File: __tests__/return-codes.test.ts
import { getReturnCodeInfo, isRetryable } from "@/lib/api/dwolla/return-codes";

describe("Return Codes", () => {
  test("should return correct info for R01", () => {
    const info = getReturnCodeInfo("R01");
    expect(info.code).toBe("R01");
    expect(info.title).toBe("Insufficient Funds");
    expect(info.retryable).toBe(true);
  });
  
  test("should handle unknown codes", () => {
    const info = getReturnCodeInfo("R99");
    expect(info.code).toBe("R99");
    expect(info.title).toBe("Unknown Return Code");
    expect(info.retryable).toBe(false);
  });
});
```

### 2. Webhook Testing
```typescript
// File: scripts/test-webhook.ts
import crypto from "crypto";

async function testWebhook() {
  const payload = {
    topic: "transfer_returned",
    timestamp: new Date().toISOString(),
    returnCode: "R01",
    _links: {
      resource: {
        href: "https://api.dwolla.com/transfers/test-transfer-id"
      }
    }
  };
  
  const secret = process.env.DWOLLA_WEBHOOK_SECRET || "test-secret";
  const signature = crypto
    .createHmac("sha256", secret)
    .update(JSON.stringify(payload))
    .digest("hex");
    
  const response = await fetch("http://localhost:3000/api/webhooks/dwolla", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Dwolla-Signature": signature
    },
    body: JSON.stringify(payload)
  });
  
  console.log("Response:", await response.json());
}
```

## Rollout Plan

### Week 1: Foundation
1. Deploy return codes mapping file
2. Enhance ACH sync with better failure extraction
3. Test with existing failed transactions

### Week 2: Real-time Updates
1. Set up webhook endpoint
2. Configure Dwolla webhook subscriptions
3. Test webhook processing

### Week 3: UI Enhancements
1. Deploy enhanced transaction detail modal
2. Add failure analytics dashboard
3. User training on new features

### Week 4: Monitoring & Optimization
1. Set up failure rate alerts
2. Monitor webhook reliability
3. Optimize based on usage patterns

## Risk Mitigation

### 1. Backward Compatibility
- All changes are additive - no existing fields removed
- Graceful handling of missing data
- Feature flags for gradual rollout

### 2. Performance
- Indexed database fields for queries
- Efficient webhook processing
- Caching for return code lookups

### 3. Security
- Webhook signature verification
- No sensitive data in logs
- Proper error handling

## Success Metrics

1. **Data Capture Rate**: >95% of failed transactions have return codes
2. **Webhook Reliability**: >99.9% webhook processing success
3. **User Understanding**: Reduced support tickets about failures
4. **Retry Success**: Increased successful retry rate for retryable codes

## Maintenance Plan

1. **Monthly Reviews**
   - Analyze failure patterns
   - Update return code mappings
   - Review webhook performance

2. **Quarterly Updates**
   - NACHA rule changes
   - New return codes
   - Performance optimization

3. **Annual Audit**
   - Full system review
   - Compliance check
   - Architecture assessment

## Conclusion

This implementation plan ensures comprehensive ACH return code capture while maintaining system stability. The phased approach allows for incremental improvements and testing at each stage. With enhanced failure tracking, the system will provide better visibility into payment failures and enable more effective resolution strategies.