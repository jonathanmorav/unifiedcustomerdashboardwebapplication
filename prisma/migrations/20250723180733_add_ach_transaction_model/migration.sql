-- CreateTable
CREATE TABLE "ACHTransaction" (
    "id" TEXT NOT NULL,
    "dwollaId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "amount" DECIMAL(15,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "direction" TEXT NOT NULL,
    "created" TIMESTAMP(3) NOT NULL,
    "lastUpdated" TIMESTAMP(3) NOT NULL,
    "sourceId" TEXT,
    "sourceName" TEXT,
    "sourceBankName" TEXT,
    "destinationId" TEXT,
    "destinationName" TEXT,
    "destinationBankName" TEXT,
    "bankLastFour" TEXT,
    "correlationId" TEXT,
    "individualAchId" TEXT,
    "customerId" TEXT,
    "customerName" TEXT,
    "customerEmail" TEXT,
    "companyName" TEXT,
    "invoiceNumber" TEXT,
    "transactionType" TEXT,
    "description" TEXT,
    "fees" DECIMAL(15,2),
    "netAmount" DECIMAL(15,2),
    "clearingDate" TIMESTAMP(3),
    "processedAt" TIMESTAMP(3),
    "failureReason" TEXT,
    "failureCode" TEXT,
    "returnCode" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ACHTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ACHTransaction_dwollaId_key" ON "ACHTransaction"("dwollaId");

-- CreateIndex
CREATE INDEX "ACHTransaction_status_idx" ON "ACHTransaction"("status");

-- CreateIndex
CREATE INDEX "ACHTransaction_created_idx" ON "ACHTransaction"("created");

-- CreateIndex
CREATE INDEX "ACHTransaction_customerName_idx" ON "ACHTransaction"("customerName");

-- CreateIndex
CREATE INDEX "ACHTransaction_dwollaId_idx" ON "ACHTransaction"("dwollaId");

-- CreateIndex
CREATE INDEX "ACHTransaction_correlationId_idx" ON "ACHTransaction"("correlationId");

-- CreateIndex
CREATE INDEX "ACHTransaction_customerEmail_idx" ON "ACHTransaction"("customerEmail");

-- CreateIndex
CREATE INDEX "ACHTransaction_companyName_idx" ON "ACHTransaction"("companyName");

-- CreateIndex
CREATE INDEX "ACHTransaction_direction_idx" ON "ACHTransaction"("direction");

-- CreateIndex
CREATE INDEX "ACHTransaction_amount_idx" ON "ACHTransaction"("amount");
