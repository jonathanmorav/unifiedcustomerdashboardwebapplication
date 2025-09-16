-- Add doubleBill field to HubSpotSOBCache table
ALTER TABLE "HubSpotSOBCache" ADD COLUMN "doubleBill" TEXT;

-- Create index on doubleBill field for efficient querying
CREATE INDEX "HubSpotSOBCache_doubleBill_idx" ON "HubSpotSOBCache"("doubleBill");
