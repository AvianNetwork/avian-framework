-- CreateTable
CREATE TABLE "assets" (
    "name" TEXT NOT NULL,
    "amount" DECIMAL(20,8) NOT NULL,
    "units" INTEGER NOT NULL,
    "reissuable" BOOLEAN NOT NULL,
    "hasIpfs" BOOLEAN NOT NULL,
    "ipfsHash" TEXT,
    "ownerAddress" TEXT,
    "lastSeenBlock" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "assets_pkey" PRIMARY KEY ("name")
);

-- CreateIndex
CREATE INDEX "assets_ownerAddress_idx" ON "assets"("ownerAddress");
