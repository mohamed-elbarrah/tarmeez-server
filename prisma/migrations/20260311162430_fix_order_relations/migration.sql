/*
  Warnings:

  - You are about to drop the column `shippingAddress` on the `Order` table. All the data in the column will be lost.
  - Added the required column `shippingCity` to the `Order` table without a default value. This is not possible if the table is not empty.
  - Added the required column `shippingRegion` to the `Order` table without a default value. This is not possible if the table is not empty.
  - Added the required column `shippingStreet` to the `Order` table without a default value. This is not possible if the table is not empty.

*/
-- -- AlterTable
-- ALTER TABLE "Order" DROP COLUMN "shippingAddress",
-- ADD COLUMN     "customerId" TEXT,
-- ADD COLUMN     "shippingBuilding" TEXT,
-- ADD COLUMN     "shippingCity" TEXT NOT NULL,
-- ADD COLUMN     "shippingRegion" TEXT NOT NULL,
-- ADD COLUMN     "shippingStreet" TEXT NOT NULL;

-- -- AddForeignKey
-- ALTER TABLE "Order" ADD CONSTRAINT "Order_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- 1) add the new columns as NULLABLE
ALTER TABLE "Order" ADD COLUMN "shippingCity" TEXT;
ALTER TABLE "Order" ADD COLUMN "shippingRegion" TEXT;
ALTER TABLE "Order" ADD COLUMN "shippingStreet" TEXT;
ALTER TABLE "Order" ADD COLUMN "shippingBuilding" TEXT;

-- 2) backfill reasonable defaults for existing rows (choose appropriate values)
UPDATE "Order" SET "shippingCity" = 'unknown' WHERE "shippingCity" IS NULL;
UPDATE "Order" SET "shippingRegion" = 'unknown' WHERE "shippingRegion" IS NULL;
UPDATE "Order" SET "shippingStreet" = 'unknown' WHERE "shippingStreet" IS NULL;

-- 3) convert to NOT NULL for required columns
ALTER TABLE "Order" ALTER COLUMN "shippingCity" SET NOT NULL;
ALTER TABLE "Order" ALTER COLUMN "shippingRegion" SET NOT NULL;
ALTER TABLE "Order" ALTER COLUMN "shippingStreet" SET NOT NULL;
-- shippingBuilding stays nullable