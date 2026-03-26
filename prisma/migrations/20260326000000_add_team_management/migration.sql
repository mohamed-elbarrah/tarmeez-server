-- CreateEnum
CREATE TYPE "StoreRole" AS ENUM ('OWNER', 'ADMIN', 'EDITOR', 'MARKETER');

-- CreateEnum
CREATE TYPE "InvitationStatus" AS ENUM ('PENDING', 'ACCEPTED', 'EXPIRED', 'CANCELLED');

-- CreateTable
CREATE TABLE "store_members" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "role" "StoreRole" NOT NULL DEFAULT 'EDITOR',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "store_members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "store_invitations" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "role" "StoreRole" NOT NULL DEFAULT 'EDITOR',
    "token" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "status" "InvitationStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "store_invitations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "store_members_storeId_idx" ON "store_members"("storeId");
CREATE UNIQUE INDEX "store_members_userId_storeId_key" ON "store_members"("userId", "storeId");

-- CreateIndex
CREATE UNIQUE INDEX "store_invitations_token_key" ON "store_invitations"("token");
CREATE INDEX "store_invitations_storeId_idx" ON "store_invitations"("storeId");
CREATE INDEX "store_invitations_token_idx" ON "store_invitations"("token");

-- AddForeignKey
ALTER TABLE "store_members" ADD CONSTRAINT "store_members_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "store_members" ADD CONSTRAINT "store_members_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "store_invitations" ADD CONSTRAINT "store_invitations_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;
