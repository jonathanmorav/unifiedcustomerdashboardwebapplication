-- CreateEnum
CREATE TYPE "ReconciliationExportStatus" AS ENUM ('pending', 'in_progress', 'completed', 'failed');

-- CreateTable
CREATE TABLE "ReconciliationExport" (
    "id" TEXT NOT NULL,
    "format" TEXT NOT NULL,
    "status" "ReconciliationExportStatus" NOT NULL DEFAULT 'pending',
    "transferIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "sobIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "coverageMonths" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "totalTransfers" INTEGER NOT NULL DEFAULT 0,
    "totalPolicies" INTEGER NOT NULL DEFAULT 0,
    "carrierTotals" JSONB NOT NULL DEFAULT '{}',
    "csvData" TEXT,
    "snapshot" JSONB,
    "fileSize" INTEGER NOT NULL DEFAULT 0,
    "fileHash" TEXT,
    "chunkCount" INTEGER NOT NULL DEFAULT 0,
    "exportedBy" TEXT NOT NULL,
    "exportedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReconciliationExport_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ReconciliationExport_status_idx" ON "ReconciliationExport"("status");

-- CreateIndex
CREATE INDEX "ReconciliationExport_exportedAt_idx" ON "ReconciliationExport"("exportedAt");
