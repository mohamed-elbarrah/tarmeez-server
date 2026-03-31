-- AlterTable
ALTER TABLE "Store" ADD COLUMN     "checkoutFieldsConfig" JSONB DEFAULT '{"name":{"enabled":true,"required":true},"phone":{"enabled":true,"required":true},"email":{"enabled":true,"required":false},"address":{"enabled":true,"required":true}}';
