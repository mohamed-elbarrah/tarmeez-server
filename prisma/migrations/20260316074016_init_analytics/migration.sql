/*
  Warnings:

  - You are about to drop the `Address` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Category` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Customer` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Merchant` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Order` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `OrderItem` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Page` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `PaymentMethod` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Product` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `ProductOffer` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `ProductOption` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `ProductOptionValue` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `ProductVariant` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `ProductVariantValue` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Review` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Store` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `User` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Wishlist` table. If the table is not empty, all the data it contains will be lost.

*/
-- CreateEnum
CREATE TYPE "DeviceType" AS ENUM ('MOBILE', 'TABLET', 'DESKTOP', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "AnalyticsEventType" AS ENUM ('CART_ADD', 'CART_REMOVE', 'CART_ABANDON', 'CHECKOUT_START', 'PRODUCT_VIEW', 'BUTTON_CLICK');

-- CreateEnum
CREATE TYPE "HeatmapEventType" AS ENUM ('CLICK', 'MOVE', 'SCROLL');

-- DropForeignKey
ALTER TABLE "Address" DROP CONSTRAINT "Address_customerId_fkey";

-- DropForeignKey
ALTER TABLE "Category" DROP CONSTRAINT "Category_storeId_fkey";

-- DropForeignKey
ALTER TABLE "Customer" DROP CONSTRAINT "Customer_storeId_fkey";

-- DropForeignKey
ALTER TABLE "Customer" DROP CONSTRAINT "Customer_userId_fkey";

-- DropForeignKey
ALTER TABLE "Merchant" DROP CONSTRAINT "Merchant_userId_fkey";

-- DropForeignKey
ALTER TABLE "Order" DROP CONSTRAINT "Order_customerId_fkey";

-- DropForeignKey
ALTER TABLE "Order" DROP CONSTRAINT "Order_storeId_fkey";

-- DropForeignKey
ALTER TABLE "OrderItem" DROP CONSTRAINT "OrderItem_orderId_fkey";

-- DropForeignKey
ALTER TABLE "Page" DROP CONSTRAINT "Page_linkedProductId_fkey";

-- DropForeignKey
ALTER TABLE "Page" DROP CONSTRAINT "Page_storeId_fkey";

-- DropForeignKey
ALTER TABLE "PaymentMethod" DROP CONSTRAINT "PaymentMethod_customerId_fkey";

-- DropForeignKey
ALTER TABLE "Product" DROP CONSTRAINT "Product_categoryId_fkey";

-- DropForeignKey
ALTER TABLE "Product" DROP CONSTRAINT "Product_storeId_fkey";

-- DropForeignKey
ALTER TABLE "ProductOffer" DROP CONSTRAINT "ProductOffer_productId_fkey";

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

-- DropForeignKey
ALTER TABLE "Review" DROP CONSTRAINT "Review_customerId_fkey";

-- DropForeignKey
ALTER TABLE "Review" DROP CONSTRAINT "Review_productId_fkey";

-- DropForeignKey
ALTER TABLE "Review" DROP CONSTRAINT "Review_storeId_fkey";

-- DropForeignKey
ALTER TABLE "Store" DROP CONSTRAINT "Store_merchantId_fkey";

-- DropForeignKey
ALTER TABLE "User" DROP CONSTRAINT "User_storeId_fkey";

-- DropForeignKey
ALTER TABLE "Wishlist" DROP CONSTRAINT "Wishlist_customerId_fkey";

-- DropForeignKey
ALTER TABLE "Wishlist" DROP CONSTRAINT "Wishlist_productId_fkey";

-- DropForeignKey
ALTER TABLE "Wishlist" DROP CONSTRAINT "Wishlist_storeId_fkey";

-- DropTable
DROP TABLE "Address";

-- DropTable
DROP TABLE "Category";

-- DropTable
DROP TABLE "Customer";

-- DropTable
DROP TABLE "Merchant";

-- DropTable
DROP TABLE "Order";

-- DropTable
DROP TABLE "OrderItem";

-- DropTable
DROP TABLE "Page";

-- DropTable
DROP TABLE "PaymentMethod";

-- DropTable
DROP TABLE "Product";

-- DropTable
DROP TABLE "ProductOffer";

-- DropTable
DROP TABLE "ProductOption";

-- DropTable
DROP TABLE "ProductOptionValue";

-- DropTable
DROP TABLE "ProductVariant";

-- DropTable
DROP TABLE "ProductVariantValue";

-- DropTable
DROP TABLE "Review";

-- DropTable
DROP TABLE "Store";

-- DropTable
DROP TABLE "User";

-- DropTable
DROP TABLE "Wishlist";

-- DropEnum
DROP TYPE "CustomerStatus";

-- DropEnum
DROP TYPE "MerchantStatus";

-- DropEnum
DROP TYPE "OrderStatus";

-- DropEnum
DROP TYPE "PageStatus";

-- DropEnum
DROP TYPE "PageType";

-- DropEnum
DROP TYPE "PaymentStatus";

-- DropEnum
DROP TYPE "ProductStatus";

-- DropEnum
DROP TYPE "UserRole";

-- CreateTable
CREATE TABLE "page_views" (
    "id" TEXT NOT NULL,
    "time" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "storeId" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "pageSlug" TEXT NOT NULL,
    "referrer" TEXT,
    "device" "DeviceType" NOT NULL DEFAULT 'UNKNOWN',
    "browser" TEXT,
    "country" TEXT,
    "city" TEXT,
    "duration" INTEGER,

    CONSTRAINT "page_views_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "analytics_events" (
    "id" TEXT NOT NULL,
    "time" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "storeId" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "type" "AnalyticsEventType" NOT NULL,
    "pageSlug" TEXT NOT NULL,
    "metadata" JSONB,

    CONSTRAINT "analytics_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "heatmap_data" (
    "id" TEXT NOT NULL,
    "time" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "storeId" TEXT NOT NULL,
    "pageSlug" TEXT NOT NULL,
    "x" DOUBLE PRECISION NOT NULL,
    "y" DOUBLE PRECISION NOT NULL,
    "type" "HeatmapEventType" NOT NULL,
    "device" "DeviceType" NOT NULL DEFAULT 'DESKTOP',

    CONSTRAINT "heatmap_data_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "analytics_hourly" (
    "id" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "hour" TIMESTAMP(3) NOT NULL,
    "pageViews" INTEGER NOT NULL DEFAULT 0,
    "uniqueVisitors" INTEGER NOT NULL DEFAULT 0,
    "avgDuration" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "bounceRate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "mobileCount" INTEGER NOT NULL DEFAULT 0,
    "tabletCount" INTEGER NOT NULL DEFAULT 0,
    "desktopCount" INTEGER NOT NULL DEFAULT 0,
    "cartAdds" INTEGER NOT NULL DEFAULT 0,
    "cartAbandons" INTEGER NOT NULL DEFAULT 0,
    "checkoutStarts" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "analytics_hourly_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "analytics_daily" (
    "id" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "pageViews" INTEGER NOT NULL DEFAULT 0,
    "uniqueVisitors" INTEGER NOT NULL DEFAULT 0,
    "avgDuration" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "bounceRate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "mobileCount" INTEGER NOT NULL DEFAULT 0,
    "tabletCount" INTEGER NOT NULL DEFAULT 0,
    "desktopCount" INTEGER NOT NULL DEFAULT 0,
    "cartAdds" INTEGER NOT NULL DEFAULT 0,
    "cartAbandons" INTEGER NOT NULL DEFAULT 0,
    "checkoutStarts" INTEGER NOT NULL DEFAULT 0,
    "organicCount" INTEGER NOT NULL DEFAULT 0,
    "socialCount" INTEGER NOT NULL DEFAULT 0,
    "directCount" INTEGER NOT NULL DEFAULT 0,
    "referralCount" INTEGER NOT NULL DEFAULT 0,
    "topPages" JSONB NOT NULL DEFAULT '[]',
    "countries" JSONB NOT NULL DEFAULT '[]',

    CONSTRAINT "analytics_daily_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "page_views_storeId_time_idx" ON "page_views"("storeId", "time");

-- CreateIndex
CREATE INDEX "page_views_storeId_pageSlug_time_idx" ON "page_views"("storeId", "pageSlug", "time");

-- CreateIndex
CREATE INDEX "analytics_events_storeId_time_idx" ON "analytics_events"("storeId", "time");

-- CreateIndex
CREATE INDEX "analytics_events_storeId_type_time_idx" ON "analytics_events"("storeId", "type", "time");

-- CreateIndex
CREATE INDEX "heatmap_data_storeId_pageSlug_type_device_idx" ON "heatmap_data"("storeId", "pageSlug", "type", "device");

-- CreateIndex
CREATE INDEX "heatmap_data_storeId_time_idx" ON "heatmap_data"("storeId", "time");

-- CreateIndex
CREATE INDEX "analytics_hourly_storeId_hour_idx" ON "analytics_hourly"("storeId", "hour");

-- CreateIndex
CREATE UNIQUE INDEX "analytics_hourly_storeId_hour_key" ON "analytics_hourly"("storeId", "hour");

-- CreateIndex
CREATE INDEX "analytics_daily_storeId_date_idx" ON "analytics_daily"("storeId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "analytics_daily_storeId_date_key" ON "analytics_daily"("storeId", "date");
