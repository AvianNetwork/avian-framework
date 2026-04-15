-- CreateEnum
CREATE TYPE "ListingStatus" AS ENUM ('ACTIVE', 'SOLD', 'CANCELLED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "OfferStatus" AS ENUM ('PENDING', 'ACCEPTED', 'REJECTED', 'WITHDRAWN', 'EXPIRED');

-- CreateEnum
CREATE TYPE "WorkflowType" AS ENUM ('LISTING', 'OFFER', 'ESCROW', 'AUCTION');

-- CreateEnum
CREATE TYPE "WorkflowStatus" AS ENUM ('DRAFT', 'ACTIVE', 'PENDING_SIGNATURE', 'PENDING_BROADCAST', 'PENDING_CONFIRMATION', 'COMPLETED', 'CANCELLED', 'EXPIRED', 'FAILED');

-- CreateEnum
CREATE TYPE "TxEventType" AS ENUM ('BROADCAST', 'CONFIRMED', 'FAILED', 'REPLACED');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "listings" (
    "id" TEXT NOT NULL,
    "sellerAddress" TEXT NOT NULL,
    "assetName" TEXT NOT NULL,
    "assetAmount" DECIMAL(20,8) NOT NULL,
    "priceAvn" DECIMAL(20,8) NOT NULL,
    "psbtBase64" TEXT NOT NULL,
    "status" "ListingStatus" NOT NULL DEFAULT 'ACTIVE',
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "listings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "offers" (
    "id" TEXT NOT NULL,
    "listingId" TEXT NOT NULL,
    "buyerAddress" TEXT NOT NULL,
    "offeredPriceAvn" DECIMAL(20,8) NOT NULL,
    "psbtBase64" TEXT,
    "status" "OfferStatus" NOT NULL DEFAULT 'PENDING',
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "offers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "psbt_records" (
    "id" TEXT NOT NULL,
    "workflowType" "WorkflowType" NOT NULL,
    "status" "WorkflowStatus" NOT NULL DEFAULT 'DRAFT',
    "psbtBase64" TEXT NOT NULL,
    "txid" TEXT,
    "sellerAddress" TEXT NOT NULL,
    "buyerAddress" TEXT,
    "assetName" TEXT NOT NULL,
    "assetAmount" DECIMAL(20,8) NOT NULL,
    "priceAvn" DECIMAL(20,8) NOT NULL,
    "feesAvn" DECIMAL(20,8),
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "listingId" TEXT,
    "offerId" TEXT,

    CONSTRAINT "psbt_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tx_events" (
    "id" TEXT NOT NULL,
    "txid" TEXT NOT NULL,
    "type" "TxEventType" NOT NULL,
    "blockHeight" INTEGER,
    "blockHash" TEXT,
    "confirmations" INTEGER NOT NULL DEFAULT 0,
    "relatedListingId" TEXT,
    "relatedOfferId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tx_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "auth_challenges" (
    "id" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "challenge" TEXT NOT NULL,
    "usedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "auth_challenges_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_address_key" ON "users"("address");

-- CreateIndex
CREATE INDEX "listings_sellerAddress_idx" ON "listings"("sellerAddress");

-- CreateIndex
CREATE INDEX "listings_assetName_idx" ON "listings"("assetName");

-- CreateIndex
CREATE INDEX "listings_status_idx" ON "listings"("status");

-- CreateIndex
CREATE INDEX "offers_listingId_idx" ON "offers"("listingId");

-- CreateIndex
CREATE INDEX "offers_buyerAddress_idx" ON "offers"("buyerAddress");

-- CreateIndex
CREATE INDEX "offers_status_idx" ON "offers"("status");

-- CreateIndex
CREATE UNIQUE INDEX "psbt_records_txid_key" ON "psbt_records"("txid");

-- CreateIndex
CREATE INDEX "psbt_records_status_idx" ON "psbt_records"("status");

-- CreateIndex
CREATE INDEX "psbt_records_txid_idx" ON "psbt_records"("txid");

-- CreateIndex
CREATE INDEX "psbt_records_sellerAddress_idx" ON "psbt_records"("sellerAddress");

-- CreateIndex
CREATE INDEX "tx_events_txid_idx" ON "tx_events"("txid");

-- CreateIndex
CREATE INDEX "tx_events_relatedListingId_idx" ON "tx_events"("relatedListingId");

-- CreateIndex
CREATE INDEX "tx_events_relatedOfferId_idx" ON "tx_events"("relatedOfferId");

-- CreateIndex
CREATE UNIQUE INDEX "auth_challenges_challenge_key" ON "auth_challenges"("challenge");

-- CreateIndex
CREATE INDEX "auth_challenges_address_idx" ON "auth_challenges"("address");

-- CreateIndex
CREATE INDEX "auth_challenges_challenge_idx" ON "auth_challenges"("challenge");

-- AddForeignKey
ALTER TABLE "listings" ADD CONSTRAINT "listings_sellerAddress_fkey" FOREIGN KEY ("sellerAddress") REFERENCES "users"("address") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "offers" ADD CONSTRAINT "offers_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "listings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "offers" ADD CONSTRAINT "offers_buyerAddress_fkey" FOREIGN KEY ("buyerAddress") REFERENCES "users"("address") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "psbt_records" ADD CONSTRAINT "psbt_records_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "listings"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "psbt_records" ADD CONSTRAINT "psbt_records_offerId_fkey" FOREIGN KEY ("offerId") REFERENCES "offers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tx_events" ADD CONSTRAINT "tx_events_relatedListingId_fkey" FOREIGN KEY ("relatedListingId") REFERENCES "listings"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tx_events" ADD CONSTRAINT "tx_events_relatedOfferId_fkey" FOREIGN KEY ("relatedOfferId") REFERENCES "offers"("id") ON DELETE SET NULL ON UPDATE CASCADE;
