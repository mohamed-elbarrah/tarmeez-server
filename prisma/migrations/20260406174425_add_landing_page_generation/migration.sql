-- CreateEnum
CREATE TYPE "GenerationStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED');

-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "isAnonymous" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "landing_page_generations" (
    "id" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "productId" TEXT,
    "status" "GenerationStatus" NOT NULL DEFAULT 'PENDING',
    "prompt" TEXT NOT NULL,
    "language" TEXT NOT NULL DEFAULT 'ar',
    "tone" TEXT NOT NULL DEFAULT 'professional',
    "content" JSONB,
    "errorMessage" TEXT,
    "pageId" TEXT,
    "retryCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "landing_page_generations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "landing_page_generations_pageId_key" ON "landing_page_generations"("pageId");

-- CreateIndex
CREATE INDEX "landing_page_generations_storeId_idx" ON "landing_page_generations"("storeId");

-- CreateIndex
CREATE INDEX "landing_page_generations_status_idx" ON "landing_page_generations"("status");

-- AddForeignKey
ALTER TABLE "landing_page_generations" ADD CONSTRAINT "landing_page_generations_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;
