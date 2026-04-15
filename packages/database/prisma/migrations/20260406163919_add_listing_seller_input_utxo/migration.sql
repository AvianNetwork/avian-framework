-- AlterTable
ALTER TABLE "listings" ADD COLUMN     "sellerInputTxid" TEXT,
ADD COLUMN     "sellerInputVout" INTEGER;

-- CreateIndex
CREATE INDEX "listings_sellerInputTxid_idx" ON "listings"("sellerInputTxid");
