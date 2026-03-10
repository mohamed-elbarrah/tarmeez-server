-- AlterTable
ALTER TABLE "Store" ADD COLUMN     "accentColor" TEXT,
ADD COLUMN     "borderRadius" TEXT,
ADD COLUMN     "favicon" TEXT,
ADD COLUMN     "logoHeight" INTEGER,
ADD COLUMN     "logoWidth" INTEGER,
ADD COLUMN     "showStoreName" BOOLEAN NOT NULL DEFAULT true;
