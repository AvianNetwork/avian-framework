/*
  Warnings:

  - You are about to drop the column `ownerAddress` on the `assets` table. All the data in the column will be lost.

*/
-- DropIndex
DROP INDEX "assets_ownerAddress_idx";

-- AlterTable
ALTER TABLE "assets" DROP COLUMN "ownerAddress";

-- CreateTable
CREATE TABLE "asset_holders" (
    "assetName" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "balance" DECIMAL(20,8) NOT NULL,
    "lastSeenBlock" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "asset_holders_pkey" PRIMARY KEY ("assetName","address")
);

-- CreateIndex
CREATE INDEX "asset_holders_address_idx" ON "asset_holders"("address");

-- AddForeignKey
ALTER TABLE "asset_holders" ADD CONSTRAINT "asset_holders_assetName_fkey" FOREIGN KEY ("assetName") REFERENCES "assets"("name") ON DELETE RESTRICT ON UPDATE CASCADE;
