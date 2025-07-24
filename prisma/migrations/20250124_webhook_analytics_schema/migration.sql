-- CreateEnum for webhook event states
CREATE TYPE "WebhookEventState" AS ENUM ('received', 'queued', 'processing', 'completed', 'failed', 'quarantined');

-- CreateEnum for validation status
CREATE TYPE "ValidationStatus" AS ENUM ('valid', 'invalid', 'warning');

-- CreateEnum for journey status
CREATE TYPE "JourneyStatus" AS ENUM ('active', 'completed', 'failed', 'abandoned', 'stuck', 'rolled_back');

-- CreateEnum for alert status
CREATE TYPE "AlertStatus" AS ENUM ('active', 'acknowledged', 'investigating', 'resolved', 'suppressed');

-- CreateTable for webhook events (main storage)
CREATE TABLE "WebhookEvent" (
    "id" TEXT NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'dwolla',
    "eventId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "resourceId" TEXT,
    "resourceType" TEXT,
    "resourceUri" TEXT,
    "topic" TEXT NOT NULL,
    
    -- Timing
    "eventTimestamp" TIMESTAMP(3) NOT NULL,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt" TIMESTAMP(3),
    
    -- Content
    "headers" JSONB NOT NULL DEFAULT '{}',
    "payload" JSONB NOT NULL,
    "payloadSize" INTEGER NOT NULL DEFAULT 0,
    
    -- Verification
    "signature" TEXT,
    "signatureValid" BOOLEAN NOT NULL DEFAULT false,
    "verificationMethod" TEXT,
    "sourceIp" TEXT,
    
    -- Processing
    "processingState" "WebhookEventState" NOT NULL DEFAULT 'received',
    "processingAttempts" INTEGER NOT NULL DEFAULT 0,
    "lastProcessingError" TEXT,
    "processingDurationMs" INTEGER,
    
    -- Deduplication
    "isDuplicate" BOOLEAN NOT NULL DEFAULT false,
    "originalEventId" TEXT,
    "duplicateCount" INTEGER NOT NULL DEFAULT 0,
    
    -- Ordering
    "eventSequence" BIGINT,
    "isOutOfOrder" BOOLEAN NOT NULL DEFAULT false,
    "expectedSequence" BIGINT,
    
    -- Recovery
    "source" TEXT NOT NULL DEFAULT 'webhook',
    "recoveryMetadata" JSONB,
    
    -- Validation
    "schemaVersion" TEXT,
    "validationStatus" "ValidationStatus" NOT NULL DEFAULT 'valid',
    "validationErrors" JSONB,
    
    -- Quarantine
    "quarantined" BOOLEAN NOT NULL DEFAULT false,
    "quarantineReason" TEXT,
    "quarantinedAt" TIMESTAMP(3),
    "quarantineReviewedAt" TIMESTAMP(3),
    "quarantineReviewedBy" TEXT,
    
    -- System
    "partitionKey" TEXT NOT NULL,
    "ttl" INTEGER,
    "archived" BOOLEAN NOT NULL DEFAULT false,
    "archivedAt" TIMESTAMP(3),
    
    -- Timestamps
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WebhookEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable for event relationships
CREATE TABLE "WebhookEventRelation" (
    "id" TEXT NOT NULL,
    "webhookEventId" TEXT NOT NULL,
    "relationType" TEXT NOT NULL,
    "relationId" TEXT NOT NULL,
    "relationTable" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WebhookEventRelation_pkey" PRIMARY KEY ("id")
);

-- CreateTable for journey definitions
CREATE TABLE "EventJourneyDefinition" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "category" TEXT NOT NULL,
    "config" JSONB NOT NULL,
    "thresholds" JSONB,
    "version" INTEGER NOT NULL DEFAULT 1,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "tags" TEXT[],
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EventJourneyDefinition_pkey" PRIMARY KEY ("id")
);

-- CreateTable for journey instances
CREATE TABLE "JourneyInstance" (
    "id" TEXT NOT NULL,
    "definitionId" TEXT NOT NULL,
    "definitionVersion" INTEGER NOT NULL,
    "resourceId" TEXT NOT NULL,
    "resourceType" TEXT NOT NULL,
    "resourceMetadata" JSONB,
    
    -- State
    "status" "JourneyStatus" NOT NULL DEFAULT 'active',
    "currentStepIndex" INTEGER NOT NULL DEFAULT 0,
    "completedSteps" TEXT[],
    "skippedSteps" TEXT[],
    
    -- Timing
    "startEventId" TEXT NOT NULL,
    "startTime" TIMESTAMP(3) NOT NULL,
    "endEventId" TEXT,
    "endTime" TIMESTAMP(3),
    "lastEventTime" TIMESTAMP(3) NOT NULL,
    "totalDurationMs" BIGINT,
    "businessDurationMs" BIGINT,
    
    -- Progress
    "progressPercentage" INTEGER NOT NULL DEFAULT 0,
    "estimatedCompletionTime" TIMESTAMP(3),
    "confidenceScore" INTEGER,
    
    -- Risk
    "riskScore" INTEGER,
    "riskFactors" TEXT[],
    "isOutlier" BOOLEAN NOT NULL DEFAULT false,
    "outlierReasons" TEXT[],
    
    -- Metadata
    "context" JSONB,
    "tags" TEXT[],
    "notes" TEXT,
    
    -- System
    "partitionKey" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "JourneyInstance_pkey" PRIMARY KEY ("id")
);

-- CreateTable for journey steps
CREATE TABLE "JourneyStep" (
    "id" TEXT NOT NULL,
    "journeyInstanceId" TEXT NOT NULL,
    "sequence" INTEGER NOT NULL,
    "stepName" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL,
    "durationFromStartMs" BIGINT NOT NULL,
    "durationFromPreviousMs" BIGINT,
    "expected" BOOLEAN NOT NULL DEFAULT true,
    "onTime" BOOLEAN NOT NULL DEFAULT true,
    "retryCount" INTEGER NOT NULL DEFAULT 0,
    "eventMetadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "JourneyStep_pkey" PRIMARY KEY ("id")
);

-- CreateTable for real-time metrics
CREATE TABLE "RealTimeMetrics" (
    "id" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL,
    "window" TEXT NOT NULL,
    "volume" JSONB NOT NULL,
    "performance" JSONB NOT NULL,
    "journeys" JSONB NOT NULL,
    "health" JSONB NOT NULL,
    "resources" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RealTimeMetrics_pkey" PRIMARY KEY ("id")
);

-- CreateTable for journey analytics
CREATE TABLE "JourneyAnalytics" (
    "id" TEXT NOT NULL,
    "definitionId" TEXT NOT NULL,
    "period" TIMESTAMP(3) NOT NULL,
    "periodType" TEXT NOT NULL,
    "metrics" JSONB NOT NULL,
    "segments" JSONB,
    "outliers" JSONB,
    "predictions" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "JourneyAnalytics_pkey" PRIMARY KEY ("id")
);

-- CreateTable for alert rules
CREATE TABLE "AlertRule" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "category" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "priority" TEXT NOT NULL,
    "condition" JSONB NOT NULL,
    "actions" JSONB NOT NULL,
    "suppression" JSONB NOT NULL,
    "tags" TEXT[],
    "owner" TEXT NOT NULL,
    "runbook" TEXT,
    "documentation" TEXT,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "lastTriggeredAt" TIMESTAMP(3),
    "triggerCount" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "AlertRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable for alert instances
CREATE TABLE "AlertInstance" (
    "id" TEXT NOT NULL,
    "ruleId" TEXT NOT NULL,
    "ruleName" TEXT NOT NULL,
    "status" "AlertStatus" NOT NULL DEFAULT 'active',
    "severity" TEXT NOT NULL,
    "triggeredAt" TIMESTAMP(3) NOT NULL,
    "acknowledgedAt" TIMESTAMP(3),
    "investigatingAt" TIMESTAMP(3),
    "resolvedAt" TIMESTAMP(3),
    "duration" BIGINT,
    "triggerContext" JSONB NOT NULL,
    "actionsTaken" JSONB,
    "escalationLevel" INTEGER NOT NULL DEFAULT 0,
    "resolution" JSONB,
    "parentAlertId" TEXT,
    "childAlertIds" TEXT[],
    "relatedIncidentId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AlertInstance_pkey" PRIMARY KEY ("id")
);

-- CreateTable for system health
CREATE TABLE "SystemHealth" (
    "id" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL,
    "components" JSONB NOT NULL,
    "overallStatus" TEXT NOT NULL,
    "activeIssues" JSONB,
    "metrics" JSONB NOT NULL,
    "capacity" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SystemHealth_pkey" PRIMARY KEY ("id")
);

-- CreateTable for reconciliation jobs
CREATE TABLE "ReconciliationJob" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "config" JSONB NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "results" JSONB,
    "errors" JSONB,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReconciliationJob_pkey" PRIMARY KEY ("id")
);

-- CreateIndex for webhook events
CREATE UNIQUE INDEX "WebhookEvent_eventId_key" ON "WebhookEvent"("eventId");
CREATE INDEX "WebhookEvent_eventType_idx" ON "WebhookEvent"("eventType");
CREATE INDEX "WebhookEvent_resourceId_idx" ON "WebhookEvent"("resourceId");
CREATE INDEX "WebhookEvent_resourceType_idx" ON "WebhookEvent"("resourceType");
CREATE INDEX "WebhookEvent_eventTimestamp_idx" ON "WebhookEvent"("eventTimestamp");
CREATE INDEX "WebhookEvent_processingState_idx" ON "WebhookEvent"("processingState");
CREATE INDEX "WebhookEvent_partitionKey_idx" ON "WebhookEvent"("partitionKey");
CREATE INDEX "WebhookEvent_createdAt_idx" ON "WebhookEvent"("createdAt");

-- CreateIndex for event relations
CREATE INDEX "WebhookEventRelation_webhookEventId_idx" ON "WebhookEventRelation"("webhookEventId");
CREATE INDEX "WebhookEventRelation_relationId_idx" ON "WebhookEventRelation"("relationId");
CREATE INDEX "WebhookEventRelation_relationType_idx" ON "WebhookEventRelation"("relationType");

-- CreateIndex for journeys
CREATE INDEX "JourneyInstance_definitionId_idx" ON "JourneyInstance"("definitionId");
CREATE INDEX "JourneyInstance_resourceId_idx" ON "JourneyInstance"("resourceId");
CREATE INDEX "JourneyInstance_status_idx" ON "JourneyInstance"("status");
CREATE INDEX "JourneyInstance_startTime_idx" ON "JourneyInstance"("startTime");
CREATE INDEX "JourneyInstance_partitionKey_idx" ON "JourneyInstance"("partitionKey");

-- CreateIndex for journey steps
CREATE INDEX "JourneyStep_journeyInstanceId_idx" ON "JourneyStep"("journeyInstanceId");
CREATE INDEX "JourneyStep_eventId_idx" ON "JourneyStep"("eventId");

-- CreateIndex for alerts
CREATE INDEX "AlertInstance_ruleId_idx" ON "AlertInstance"("ruleId");
CREATE INDEX "AlertInstance_status_idx" ON "AlertInstance"("status");
CREATE INDEX "AlertInstance_triggeredAt_idx" ON "AlertInstance"("triggeredAt");

-- AddForeignKey
ALTER TABLE "WebhookEventRelation" ADD CONSTRAINT "WebhookEventRelation_webhookEventId_fkey" FOREIGN KEY ("webhookEventId") REFERENCES "WebhookEvent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JourneyInstance" ADD CONSTRAINT "JourneyInstance_definitionId_fkey" FOREIGN KEY ("definitionId") REFERENCES "EventJourneyDefinition"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JourneyInstance" ADD CONSTRAINT "JourneyInstance_startEventId_fkey" FOREIGN KEY ("startEventId") REFERENCES "WebhookEvent"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JourneyStep" ADD CONSTRAINT "JourneyStep_journeyInstanceId_fkey" FOREIGN KEY ("journeyInstanceId") REFERENCES "JourneyInstance"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JourneyStep" ADD CONSTRAINT "JourneyStep_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "WebhookEvent"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AlertInstance" ADD CONSTRAINT "AlertInstance_ruleId_fkey" FOREIGN KEY ("ruleId") REFERENCES "AlertRule"("id") ON DELETE RESTRICT ON UPDATE CASCADE;