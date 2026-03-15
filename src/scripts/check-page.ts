import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const store = await prisma.store.findUnique({
    where: { slug: 'demo-store' },
  });
  
  if (!store) {
    console.log('Store demo-store not found');
    return;
  }

  const page = await prisma.page.findFirst({
    where: { 
      slug: 'test5',
      storeId: store.id
    },
  });

  if (!page) {
    console.log('Page test5 not found in demo-store');
    // Check if it exists in any store
    const anyPage = await prisma.page.findFirst({
      where: { slug: 'test5' },
      include: { store: true }
    });
    if (anyPage) {
        console.log('Page test5 found in store:', anyPage.store.slug, 'with status:', anyPage.status);
    } else {
        console.log('Page test5 not found anywhere');
    }
  } else {
    console.log('Page test5 found in demo-store with status:', page.status);
    console.log('Full Page Object:', JSON.stringify(page, null, 2));
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
