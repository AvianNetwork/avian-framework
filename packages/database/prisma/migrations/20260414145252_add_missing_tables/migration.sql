/*
  Warnings:

  - A unique constraint covering the columns `[username]` on the table `users` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "users" ADD COLUMN     "avatarUrl" TEXT,
ADD COLUMN     "bannerPosition" TEXT DEFAULT '50% 50%',
ADD COLUMN     "bannerUrl" TEXT,
ADD COLUMN     "bio" TEXT,
ADD COLUMN     "discordHandle" TEXT,
ADD COLUMN     "displayName" TEXT,
ADD COLUMN     "twitterHandle" TEXT,
ADD COLUMN     "username" TEXT,
ADD COLUMN     "website" TEXT;

-- CreateTable
CREATE TABLE "user_wallets" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "label" TEXT,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_wallets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "asset_metadata" (
    "assetName" TEXT NOT NULL,
    "title" TEXT,
    "description" TEXT,
    "externalUrl" TEXT,
    "traits" JSONB,
    "creatorAddress" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "asset_metadata_pkey" PRIMARY KEY ("assetName")
);

-- CreateTable
CREATE TABLE "asset_holder_notes" (
    "assetName" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "note" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "asset_holder_notes_pkey" PRIMARY KEY ("assetName","address")
);

-- CreateTable
CREATE TABLE "asset_holder_metadata" (
    "assetName" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "title" TEXT,
    "description" TEXT,
    "externalUrl" TEXT,
    "traits" JSONB,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "asset_holder_metadata_pkey" PRIMARY KEY ("assetName","address")
);

-- CreateTable
CREATE TABLE "collections" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "bannerUrl" TEXT,
    "avatarUrl" TEXT,
    "website" TEXT,
    "twitterHandle" TEXT,
    "discordHandle" TEXT,
    "royaltyPercent" DECIMAL(5,2),
    "isVerified" BOOLEAN NOT NULL DEFAULT false,
    "ownerAddress" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "collections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "collection_items" (
    "collectionId" TEXT NOT NULL,
    "assetName" TEXT NOT NULL,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "addedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "collection_items_pkey" PRIMARY KEY ("collectionId","assetName")
);

-- CreateTable
CREATE TABLE "likes" (
    "id" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "targetType" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "likes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "link" TEXT,
    "read" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "user_wallets_address_key" ON "user_wallets"("address");

-- CreateIndex
CREATE INDEX "user_wallets_userId_idx" ON "user_wallets"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "collections_slug_key" ON "collections"("slug");

-- CreateIndex
CREATE INDEX "collections_ownerAddress_idx" ON "collections"("ownerAddress");

-- CreateIndex
CREATE INDEX "collection_items_assetName_idx" ON "collection_items"("assetName");

-- CreateIndex
CREATE INDEX "likes_targetType_targetId_idx" ON "likes"("targetType", "targetId");

-- CreateIndex
CREATE UNIQUE INDEX "likes_address_targetType_targetId_key" ON "likes"("address", "targetType", "targetId");

-- CreateIndex
CREATE INDEX "notifications_address_read_idx" ON "notifications"("address", "read");

-- CreateIndex
CREATE INDEX "notifications_address_createdAt_idx" ON "notifications"("address", "createdAt" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "users_username_key" ON "users"("username");

-- AddForeignKey
ALTER TABLE "user_wallets" ADD CONSTRAINT "user_wallets_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "listings" ADD CONSTRAINT "listings_assetName_fkey" FOREIGN KEY ("assetName") REFERENCES "assets"("name") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asset_metadata" ADD CONSTRAINT "asset_metadata_assetName_fkey" FOREIGN KEY ("assetName") REFERENCES "assets"("name") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asset_holder_notes" ADD CONSTRAINT "asset_holder_notes_assetName_fkey" FOREIGN KEY ("assetName") REFERENCES "assets"("name") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asset_holder_metadata" ADD CONSTRAINT "asset_holder_metadata_assetName_fkey" FOREIGN KEY ("assetName") REFERENCES "assets"("name") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "collections" ADD CONSTRAINT "collections_ownerAddress_fkey" FOREIGN KEY ("ownerAddress") REFERENCES "users"("address") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "collection_items" ADD CONSTRAINT "collection_items_assetName_fkey" FOREIGN KEY ("assetName") REFERENCES "assets"("name") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "collection_items" ADD CONSTRAINT "collection_items_collectionId_fkey" FOREIGN KEY ("collectionId") REFERENCES "collections"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
