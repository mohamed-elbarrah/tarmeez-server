/*
  Warnings:

  - You are about to drop the `ProductOption` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `ProductOptionValue` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `ProductVariant` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `ProductVariantValue` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "ProductOption" DROP CONSTRAINT "ProductOption_productId_fkey";

-- DropForeignKey
ALTER TABLE "ProductOptionValue" DROP CONSTRAINT "ProductOptionValue_optionId_fkey";

-- DropForeignKey
ALTER TABLE "ProductVariant" DROP CONSTRAINT "ProductVariant_productId_fkey";

-- DropForeignKey
ALTER TABLE "ProductVariantValue" DROP CONSTRAINT "ProductVariantValue_optionValueId_fkey";

-- DropForeignKey
ALTER TABLE "ProductVariantValue" DROP CONSTRAINT "ProductVariantValue_variantId_fkey";

-- DropTable
DROP TABLE "ProductOption";

-- DropTable
DROP TABLE "ProductOptionValue";

-- DropTable
DROP TABLE "ProductVariant";

-- DropTable
DROP TABLE "ProductVariantValue";
