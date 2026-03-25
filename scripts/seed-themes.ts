/**
 * Seed script: Theme Registry
 *
 * Usage:
 *   npx ts-node -r tsconfig-paths/register scripts/seed-themes.ts
 *
 * What it does:
 *   1. Creates the 'default' theme record (idempotent — uses upsert).
 *   2. Links every Store that has no themeId to the 'default' theme.
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const THEMES = [
  {
    slug: 'default',
    name: 'Default',
    previewImage: null,
    defaultConfig: {
      primary: '#2563eb',
      secondary: '#0f172a',
      accent: '#f59e0b',
      textColor: '#1e293b',
      headingColor: '#000000',
      buttonColor: '#2563eb',
      fontFamily: "'Cairo', sans-serif",
      borderRadius: '8px',
      logoWidth: 120,
      logoHeight: 40,
      showStoreName: true,
    },
    isActive: true,
  },
];

async function main() {
  console.log('🌱  Seeding themes...');

  for (const theme of THEMES) {
    const record = await (prisma as any).theme.upsert({
      where: { slug: theme.slug },
      update: {
        name: theme.name,
        defaultConfig: theme.defaultConfig,
        isActive: theme.isActive,
      },
      create: theme,
    });

    console.log(`  ✅  Theme '${record.slug}' → id: ${record.id}`);

    // Link all stores that have no themeId to this theme
    if (theme.slug === 'default') {
      const result = await prisma.store.updateMany({
        where: { themeId: null } as any,
        data: { themeId: record.id } as any,
      });
      console.log(`  🔗  Linked ${result.count} store(s) to '${record.slug}' theme`);
    }
  }

  console.log('\n✨  Theme seeding complete.');
}

main()
  .catch((e) => {
    console.error('❌  Seed error:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
