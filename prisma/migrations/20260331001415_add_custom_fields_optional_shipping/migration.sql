-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "customFields" JSONB,
ALTER COLUMN "shippingCity" DROP NOT NULL,
ALTER COLUMN "shippingRegion" DROP NOT NULL,
ALTER COLUMN "shippingStreet" DROP NOT NULL;

-- AlterTable
ALTER TABLE "Store" ALTER COLUMN "checkoutFieldsConfig" SET DEFAULT '[]';
