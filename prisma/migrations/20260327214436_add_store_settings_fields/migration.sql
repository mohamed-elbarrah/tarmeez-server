-- AlterTable
ALTER TABLE "Store" ADD COLUMN     "currencyIcon" TEXT,
ADD COLUMN     "isTaxEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "socialLinks" JSONB DEFAULT '[]',
ADD COLUMN     "supportEmail" TEXT,
ADD COLUMN     "supportWhatsapp" TEXT,
ADD COLUMN     "systemCurrency" TEXT NOT NULL DEFAULT 'SAR',
ADD COLUMN     "taxNumber" TEXT,
ADD COLUMN     "taxPercentage" DOUBLE PRECISION NOT NULL DEFAULT 15.0;
