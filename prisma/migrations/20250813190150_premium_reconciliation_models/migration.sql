-- CreateEnum
CREATE TYPE "ReconciliationStatus" AS ENUM ('pending', 'in_progress', 'completed', 'failed', 'resolved');

-- CreateEnum
CREATE TYPE "AnomalySeverity" AS ENUM ('low', 'medium', 'high', 'critical');

-- CreateEnum
CREATE TYPE "AnomalyStatus" AS ENUM ('active', 'investigating', 'resolved', 'false_positive');

-- AlterTable
ALTER TABLE "ACHTransaction" ADD COLUMN     "failureDetails" JSONB DEFAULT '{}',
ADD COLUMN     "lastWebhookAt" TIMESTAMP(3),
ADD COLUMN     "webhookEvents" JSONB DEFAULT '[]';

-- CreateTable
CREATE TABLE "ReconciliationCheck" (
    "id" TEXT NOT NULL,
    "checkType" TEXT NOT NULL,
    "status" "ReconciliationStatus" NOT NULL DEFAULT 'pending',
    "recordCount" INTEGER NOT NULL,
    "discrepancyCount" INTEGER NOT NULL DEFAULT 0,
    "startTime" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endTime" TIMESTAMP(3),
    "metadata" JSONB,
    "resolvedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReconciliationCheck_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReconciliationDiscrepancy" (
    "id" TEXT NOT NULL,
    "checkId" TEXT NOT NULL,
    "resourceId" TEXT NOT NULL,
    "resourceType" TEXT NOT NULL,
    "field" TEXT NOT NULL,
    "dwollaValue" TEXT,
    "localValue" TEXT,
    "resolved" BOOLEAN NOT NULL DEFAULT false,
    "resolvedAt" TIMESTAMP(3),
    "resolvedBy" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReconciliationDiscrepancy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WebhookAnomaly" (
    "id" TEXT NOT NULL,
    "anomalyType" TEXT NOT NULL,
    "severity" "AnomalySeverity" NOT NULL,
    "status" "AnomalyStatus" NOT NULL DEFAULT 'active',
    "description" TEXT NOT NULL,
    "detectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),
    "confidence" DOUBLE PRECISION NOT NULL DEFAULT 0.5,
    "affectedEventCount" INTEGER NOT NULL DEFAULT 0,
    "metadata" JSONB,

    CONSTRAINT "WebhookAnomaly_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EventMetric" (
    "id" TEXT NOT NULL,
    "metricName" TEXT NOT NULL,
    "eventType" TEXT,
    "resourceType" TEXT,
    "value" DOUBLE PRECISION NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL,
    "aggregation" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EventMetric_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EventAnomaly" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "anomalyType" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL,
    "detectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolved" BOOLEAN NOT NULL DEFAULT false,
    "resolvedAt" TIMESTAMP(3),
    "metadata" JSONB,

    CONSTRAINT "EventAnomaly_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Carrier" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Carrier_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Transaction" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "status" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Transaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Policy" (
    "id" TEXT NOT NULL,
    "policyNumber" TEXT NOT NULL,
    "transactionId" TEXT NOT NULL,
    "premiumAmount" DECIMAL(10,2) NOT NULL,
    "carrierId" TEXT,
    "effectiveDate" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL,
    "productName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Policy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_AnomalyToEvents" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_AnomalyToEvents_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE INDEX "ReconciliationCheck_status_idx" ON "ReconciliationCheck"("status");

-- CreateIndex
CREATE INDEX "ReconciliationCheck_checkType_idx" ON "ReconciliationCheck"("checkType");

-- CreateIndex
CREATE INDEX "ReconciliationCheck_createdAt_idx" ON "ReconciliationCheck"("createdAt");

-- CreateIndex
CREATE INDEX "ReconciliationDiscrepancy_checkId_idx" ON "ReconciliationDiscrepancy"("checkId");

-- CreateIndex
CREATE INDEX "ReconciliationDiscrepancy_resolved_idx" ON "ReconciliationDiscrepancy"("resolved");

-- CreateIndex
CREATE INDEX "WebhookAnomaly_status_idx" ON "WebhookAnomaly"("status");

-- CreateIndex
CREATE INDEX "WebhookAnomaly_severity_idx" ON "WebhookAnomaly"("severity");

-- CreateIndex
CREATE INDEX "WebhookAnomaly_detectedAt_idx" ON "WebhookAnomaly"("detectedAt");

-- CreateIndex
CREATE INDEX "EventMetric_metricName_timestamp_idx" ON "EventMetric"("metricName", "timestamp");

-- CreateIndex
CREATE INDEX "EventMetric_eventType_idx" ON "EventMetric"("eventType");

-- CreateIndex
CREATE INDEX "EventMetric_timestamp_idx" ON "EventMetric"("timestamp");

-- CreateIndex
CREATE INDEX "EventAnomaly_eventId_idx" ON "EventAnomaly"("eventId");

-- CreateIndex
CREATE INDEX "EventAnomaly_resolved_idx" ON "EventAnomaly"("resolved");

-- CreateIndex
CREATE INDEX "EventAnomaly_detectedAt_idx" ON "EventAnomaly"("detectedAt");

-- CreateIndex
CREATE UNIQUE INDEX "Carrier_name_key" ON "Carrier"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Carrier_code_key" ON "Carrier"("code");

-- CreateIndex
CREATE INDEX "Transaction_status_idx" ON "Transaction"("status");

-- CreateIndex
CREATE INDEX "Transaction_date_idx" ON "Transaction"("date");

-- CreateIndex
CREATE UNIQUE INDEX "Policy_policyNumber_key" ON "Policy"("policyNumber");

-- CreateIndex
CREATE INDEX "Policy_transactionId_idx" ON "Policy"("transactionId");

-- CreateIndex
CREATE INDEX "Policy_carrierId_idx" ON "Policy"("carrierId");

-- CreateIndex
CREATE INDEX "_AnomalyToEvents_B_index" ON "_AnomalyToEvents"("B");

-- CreateIndex
CREATE INDEX "ACHTransaction_failureCode_idx" ON "ACHTransaction"("failureCode");

-- CreateIndex
CREATE INDEX "ACHTransaction_returnCode_idx" ON "ACHTransaction"("returnCode");

-- CreateIndex
CREATE INDEX "ACHTransaction_lastWebhookAt_idx" ON "ACHTransaction"("lastWebhookAt");

-- CreateIndex
CREATE INDEX "AlertRule_category_idx" ON "AlertRule"("category");

-- CreateIndex
CREATE INDEX "AlertRule_enabled_idx" ON "AlertRule"("enabled");

-- CreateIndex
CREATE INDEX "EventJourneyDefinition_category_idx" ON "EventJourneyDefinition"("category");

-- CreateIndex
CREATE INDEX "EventJourneyDefinition_active_idx" ON "EventJourneyDefinition"("active");

-- CreateIndex
CREATE INDEX "JourneyAnalytics_definitionId_idx" ON "JourneyAnalytics"("definitionId");

-- CreateIndex
CREATE INDEX "JourneyAnalytics_period_idx" ON "JourneyAnalytics"("period");

-- CreateIndex
CREATE INDEX "JourneyAnalytics_periodType_idx" ON "JourneyAnalytics"("periodType");

-- CreateIndex
CREATE INDEX "RealTimeMetrics_timestamp_idx" ON "RealTimeMetrics"("timestamp");

-- CreateIndex
CREATE INDEX "RealTimeMetrics_window_idx" ON "RealTimeMetrics"("window");

-- CreateIndex
CREATE INDEX "ReconciliationJob_type_idx" ON "ReconciliationJob"("type");

-- CreateIndex
CREATE INDEX "ReconciliationJob_status_idx" ON "ReconciliationJob"("status");

-- CreateIndex
CREATE INDEX "ReconciliationJob_createdAt_idx" ON "ReconciliationJob"("createdAt");

-- CreateIndex
CREATE INDEX "SystemHealth_timestamp_idx" ON "SystemHealth"("timestamp");

-- CreateIndex
CREATE INDEX "SystemHealth_overallStatus_idx" ON "SystemHealth"("overallStatus");

-- AddForeignKey
ALTER TABLE "JourneyAnalytics" ADD CONSTRAINT "JourneyAnalytics_definitionId_fkey" FOREIGN KEY ("definitionId") REFERENCES "EventJourneyDefinition"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReconciliationDiscrepancy" ADD CONSTRAINT "ReconciliationDiscrepancy_checkId_fkey" FOREIGN KEY ("checkId") REFERENCES "ReconciliationCheck"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Policy" ADD CONSTRAINT "Policy_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "Transaction"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Policy" ADD CONSTRAINT "Policy_carrierId_fkey" FOREIGN KEY ("carrierId") REFERENCES "Carrier"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_AnomalyToEvents" ADD CONSTRAINT "_AnomalyToEvents_A_fkey" FOREIGN KEY ("A") REFERENCES "WebhookAnomaly"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_AnomalyToEvents" ADD CONSTRAINT "_AnomalyToEvents_B_fkey" FOREIGN KEY ("B") REFERENCES "WebhookEvent"("id") ON DELETE CASCADE ON UPDATE CASCADE;
