-- CreateTable
CREATE TABLE "ListSnapshot" (
    "id" TEXT NOT NULL,
    "listId" INTEGER NOT NULL,
    "listName" TEXT NOT NULL,
    "listType" TEXT NOT NULL,
    "memberCount" INTEGER NOT NULL,
    "snapshotDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ListSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ListMetadata" (
    "id" TEXT NOT NULL,
    "listId" INTEGER NOT NULL,
    "listName" TEXT NOT NULL,
    "listType" TEXT NOT NULL,
    "internalName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "lastSnapshotDate" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "ListMetadata_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ListSnapshot_listId_idx" ON "ListSnapshot"("listId");

-- CreateIndex
CREATE INDEX "ListSnapshot_snapshotDate_idx" ON "ListSnapshot"("snapshotDate");

-- CreateIndex
CREATE UNIQUE INDEX "ListSnapshot_listId_snapshotDate_key" ON "ListSnapshot"("listId", "snapshotDate");

-- CreateIndex
CREATE UNIQUE INDEX "ListMetadata_listId_key" ON "ListMetadata"("listId");

-- CreateIndex
CREATE INDEX "ListMetadata_listId_idx" ON "ListMetadata"("listId");
