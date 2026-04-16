-- AlterEnum
ALTER TYPE "WorkflowType" ADD VALUE 'GIFT';

-- CreateTable
CREATE TABLE "gifts" (
    "id" TEXT NOT NULL,
    "senderAddress" TEXT NOT NULL,
    "recipientAddress" TEXT NOT NULL,
    "assetName" TEXT NOT NULL,
    "assetAmount" DECIMAL(20,8) NOT NULL,
    "txid" TEXT NOT NULL,
    "feeAvn" DECIMAL(20,8) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "gifts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "gifts_txid_key" ON "gifts"("txid");

-- CreateIndex
CREATE INDEX "gifts_senderAddress_idx" ON "gifts"("senderAddress");

-- CreateIndex
CREATE INDEX "gifts_recipientAddress_idx" ON "gifts"("recipientAddress");

-- CreateIndex
CREATE INDEX "gifts_assetName_idx" ON "gifts"("assetName");

-- CreateIndex
CREATE INDEX "gifts_txid_idx" ON "gifts"("txid");
