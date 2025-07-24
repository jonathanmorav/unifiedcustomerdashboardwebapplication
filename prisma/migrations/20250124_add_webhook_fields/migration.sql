-- Add webhook tracking fields to ACHTransaction
ALTER TABLE "ACHTransaction" 
ADD COLUMN IF NOT EXISTS "failureDetails" JSONB DEFAULT '{}',
ADD COLUMN IF NOT EXISTS "webhookEvents" JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS "lastWebhookAt" TIMESTAMP(3);

-- Add indexes for better query performance
CREATE INDEX IF NOT EXISTS "ACHTransaction_failureCode_idx" ON "ACHTransaction"("failureCode");
CREATE INDEX IF NOT EXISTS "ACHTransaction_returnCode_idx" ON "ACHTransaction"("returnCode");
CREATE INDEX IF NOT EXISTS "ACHTransaction_lastWebhookAt_idx" ON "ACHTransaction"("lastWebhookAt");