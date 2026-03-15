import { PrismaClient, PageStatus } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const result = await prisma.page.updateMany({
    where: { slug: 'test5' },
    data: { status: PageStatus.PUBLISHED }
  });
  
  console.log(`Updated ${result.count} pages to PUBLISHED`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
