-- CreateEnum
CREATE TYPE "ActivityType" AS ENUM ('RETAIL', 'CHARITY');

-- AlterTable: Add activityType to Store
ALTER TABLE "Store" ADD COLUMN "activityType" "ActivityType" NOT NULL DEFAULT 'RETAIL';

-- AlterTable: Add donationMetadata to Product
ALTER TABLE "Product" ADD COLUMN "donationMetadata" JSONB;
