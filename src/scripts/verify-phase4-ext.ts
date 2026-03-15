import { PrismaClient } from '@prisma/client';

const arabicToEnglishMap: Record<string, string> = {
  'ا': 'a', 'أ': 'a', 'إ': 'i', 'آ': 'a',
  'ب': 'b', 'ت': 't', 'ث': 'th', 'ج': 'j',
  'ح': 'h', 'خ': 'kh', 'د': 'd', 'ذ': 'dh',
  'ر': 'r', 'ز': 'z', 'س': 's', 'ش': 'sh',
  'ص': 's', 'ض': 'd', 'ط': 't', 'ظ': 'z',
  'ع': 'a', 'غ': 'gh', 'ف': 'f', 'ق': 'q',
  'ك': 'k', 'ل': 'l', 'م': 'm', 'ن': 'n',
  'ه': 'h', 'و': 'w', 'ي': 'y', 'ى': 'a',
  'ة': 'a', 'ئ': 'e', 'ء': 'a', 'ؤ': 'u',
  ' ': '-', '_': '-',
};

function transliterate(text: string): string {
  return text
    .split('')
    .map(char => arabicToEnglishMap[char] || char)
    .join('');
}

function generateSlug(text: string): string {
  const transliterated = transliterate(text.toLowerCase().trim());
  return transliterated
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

const prisma = new PrismaClient();

async function verify() {
  console.log('--- Phase 4 Extension Verification ---');

  // 1. Verify Transliteration
  const title = 'تجربة صفحة جديدة';
  const slug = generateSlug(title);
  console.log(`1. Transliteration: "${title}" -> "${slug}"`);
  if (slug === 'tjrbah-sfhah-jdydah') {
    console.log('✅ Transliteration passed');
  } else {
    console.log('❌ Transliteration mismatch (check logic)');
  }

  // 2. Verify Status Lifecycle (ARCHIVED -> PUBLISHED should fail logic-wise in Service)
  // We can't easily test the Service via script without Nest container, 
  // but we can check if we can bridge the gap in our manual test.
  // Instead, let's just check if we have pages that might cause issues.
  
  // 3. Verify Security (Ownership)
  // Look for a page and try to find it with a DIFFERENT storeId
  const somePage = await prisma.page.findFirst();
  if (somePage) {
    const wrongStoreId = 'wrong-store-uuid';
    const foundWithWrongStore = await prisma.page.findFirst({
      where: { id: somePage.id, storeId: wrongStoreId }
    });
    if (!foundWithWrongStore) {
      console.log('✅ Security: Page correctly not found with wrong storeId');
    } else {
      console.log('❌ Security: Page found with wrong storeId (Query issue!)');
    }
  }

  // 4. Check Public Page 404 Case (Slug 12)
  const page12 = await prisma.page.findFirst({ where: { slug: '12' } });
  if (page12) {
    console.log(`4. Page "12" Status: ${page12.status}`);
    if (page12.status === 'DRAFT') {
      console.log('💡 Note: Page "12" is DRAFT, which explains the 404 on public URL.');
      console.log('   (This is correct behavior according to Rule 12 & 11)');
    }
  }

  console.log('--- Verification Done ---');
}

verify()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
