/**
 * One-time migration: update all product and category slugs
 * from transliterated English to Arabic-preserved format.
 *
 * Run: npx ts-node --project tsconfig.json scripts/fix-arabic-slugs.ts
 */
import { PrismaClient } from '@prisma/client';

function generateArabicSlug(name: string): string {
  return name
    .trim()
    .replace(/\s+/g, '-')
    // Keep Arabic (U+0600–U+06FF, U+0750–U+077F), Latin alphanumeric, digits, hyphens
    .replace(/[^\u0600-\u06FF\u0750-\u077Fa-zA-Z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase();
}

async function main() {
  const prisma = new PrismaClient();

  try {
    // ── Products ──────────────────────────────────────────────
    const products = await prisma.product.findMany({
      select: { id: true, name: true, slug: true, storeId: true },
    });

    let productUpdated = 0;
    for (const product of products) {
      const newSlug = generateArabicSlug(product.name);
      if (!newSlug || newSlug === product.slug) continue;

      // Guard against duplicate slug within same store
      const conflict = await prisma.product.findFirst({
        where: { storeId: product.storeId, slug: newSlug, NOT: { id: product.id } },
      });
      if (conflict) {
        console.warn(
          `Skipping product "${product.name}" — slug "${newSlug}" already taken in store ${product.storeId}`,
        );
        continue;
      }

      await prisma.product.update({
        where: { id: product.id },
        data: { slug: newSlug },
      });
      console.log(`Product: "${product.slug}" → "${newSlug}"  (${product.name})`);
      productUpdated++;
    }

    // ── Categories ────────────────────────────────────────────
    const categories = await prisma.category.findMany({
      select: { id: true, name: true, slug: true, storeId: true },
    });

    let categoryUpdated = 0;
    for (const cat of categories) {
      const newSlug = generateArabicSlug(cat.name);
      if (!newSlug || newSlug === cat.slug) continue;

      const conflict = await prisma.category.findFirst({
        where: { storeId: cat.storeId, slug: newSlug, NOT: { id: cat.id } },
      });
      if (conflict) {
        console.warn(
          `Skipping category "${cat.name}" — slug "${newSlug}" already taken in store ${cat.storeId}`,
        );
        continue;
      }

      await prisma.category.update({
        where: { id: cat.id },
        data: { slug: newSlug },
      });
      console.log(`Category: "${cat.slug}" → "${newSlug}"  (${cat.name})`);
      categoryUpdated++;
    }

    console.log(
      `\nDone. Updated ${productUpdated}/${products.length} products, ${categoryUpdated}/${categories.length} categories.`,
    );
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
