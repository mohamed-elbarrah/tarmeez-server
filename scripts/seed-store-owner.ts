/**
 * seed-store-owner.ts
 *
 * One-time script: ensures the store owner has a StoreMember record with
 * role OWNER in the database. Run this for any merchant whose store was
 * created before the StoreMember OWNER record was added to the registration
 * transaction.
 *
 * Usage:
 *   npx ts-node -e "require('./scripts/seed-store-owner')"
 *   — or —
 *   npx tsx scripts/seed-store-owner.ts
 */

import { PrismaClient, StoreRole } from '@prisma/client';

const prisma = new PrismaClient();

async function main(): Promise<void> {
  // Find all merchants whose stores have no OWNER StoreMember record yet
  const stores = await prisma.store.findMany({
    include: {
      merchant: {
        include: { user: true },
      },
      members: {
        where: { role: StoreRole.OWNER },
      },
    },
  });

  let seeded = 0;

  for (const store of stores) {
    if (store.members.length > 0) {
      // OWNER already exists for this store — nothing to do
      continue;
    }

    if (!store.merchant?.user) {
      console.warn(
        `Store ${store.id} (${store.name}) has no linked user — skipping`,
      );
      continue;
    }

    const userId = store.merchant.user.id;

    await prisma.storeMember.upsert({
      where: { userId_storeId: { userId, storeId: store.id } },
      update: { role: StoreRole.OWNER },
      create: {
        userId,
        storeId: store.id,
        role: StoreRole.OWNER,
      },
    });

    console.log(
      `✅  Created OWNER StoreMember for store "${store.name}" (${store.id}) — user ${userId}`,
    );
    seeded++;
  }

  if (seeded === 0) {
    console.log('ℹ️   No stores were missing an OWNER StoreMember record.');
  } else {
    console.log(`\nDone. ${seeded} record(s) seeded.`);
  }
}

main()
  .catch((err) => {
    console.error('❌  Seed failed:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
