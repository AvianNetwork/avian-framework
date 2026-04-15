-- CreateEnum
CREATE TYPE "BlindOfferStatus" AS ENUM ('PENDING', 'ACCEPTED', 'REJECTED', 'WITHDRAWN', 'EXPIRED', 'COMPLETED');

-- CreateTable
CREATE TABLE "blind_offers" (
    "id" TEXT NOT NULL,
    "buyerAddress" TEXT NOT NULL,
    "assetName" TEXT NOT NULL,
    "assetAmount" DECIMAL(20,8) NOT NULL,
    "offeredPriceAvn" DECIMAL(20,8) NOT NULL,
    "status" "BlindOfferStatus" NOT NULL DEFAULT 'PENDING',
    "ttlSeconds" INTEGER,
    "expiresAt" TIMESTAMP(3),
    "listingId" TEXT,
    "offerId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "blind_offers_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "blind_offers_assetName_idx" ON "blind_offers"("assetName");

-- CreateIndex
CREATE INDEX "blind_offers_buyerAddress_idx" ON "blind_offers"("buyerAddress");

-- CreateIndex
CREATE INDEX "blind_offers_status_idx" ON "blind_offers"("status");

-- AddForeignKey
ALTER TABLE "blind_offers" ADD CONSTRAINT "blind_offers_buyerAddress_fkey" FOREIGN KEY ("buyerAddress") REFERENCES "users"("address") ON DELETE RESTRICT ON UPDATE CASCADE;
