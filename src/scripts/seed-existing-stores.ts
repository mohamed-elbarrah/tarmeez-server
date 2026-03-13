import { PrismaClient } from '@prisma/client';
import { seedStoreData } from '../prisma/seed-store';

const prisma = new PrismaClient();

async function main() {
  const args = process.argv.slice(2);
  const targetStoreId = args[0];

  if (targetStoreId) {
    console.log(`Seeding specific store: ${targetStoreId}`);
    const store = await prisma.store.findUnique({ where: { id: targetStoreId } });
    if (!store) {
      console.error(`Store not found: ${targetStoreId}`);
      process.exit(1);
    }
    await seedStoreData(prisma, targetStoreId);
  } else {
    console.log('Seeding all empty stores (stores with zero products)...');
    const stores = await prisma.store.findMany({
      include: {
        _count: {
          select: { products: true }
        }
      }
    });

    const emptyStores = stores.filter(s => s._count.products === 0);
    console.log(`Found ${emptyStores.length} empty stores to seed.`);

    for (const store of emptyStores) {
      await seedStoreData(prisma, store.id);
    }
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
