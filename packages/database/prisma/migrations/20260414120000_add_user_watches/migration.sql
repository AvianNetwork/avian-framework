-- CreateTable
CREATE TABLE "user_watches" (
    "id" TEXT NOT NULL,
    "watcherAddress" TEXT NOT NULL,
    "watchedAddress" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_watches_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "user_watches_watcherAddress_watchedAddress_key" ON "user_watches"("watcherAddress", "watchedAddress");

-- CreateIndex
CREATE INDEX "user_watches_watcherAddress_idx" ON "user_watches"("watcherAddress");

-- CreateIndex
CREATE INDEX "user_watches_watchedAddress_idx" ON "user_watches"("watchedAddress");

-- AddForeignKey
ALTER TABLE "user_watches" ADD CONSTRAINT "user_watches_watcherAddress_fkey" FOREIGN KEY ("watcherAddress") REFERENCES "users"("address") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_watches" ADD CONSTRAINT "user_watches_watchedAddress_fkey" FOREIGN KEY ("watchedAddress") REFERENCES "users"("address") ON DELETE RESTRICT ON UPDATE CASCADE;
