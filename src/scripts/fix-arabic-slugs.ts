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

async function main() {
  console.log('--- Starting Arabic Slug Migration ---');
  
  const pages = await prisma.page.findMany();
  let count = 0;

  for (const page of pages) {
    const hasArabic = /[\u0600-\u06FF]/.test(page.slug);
    if (hasArabic) {
      const newSlug = generateSlug(page.title);
      
      console.log(`Fixing page "${page.title}": ${page.slug} -> ${newSlug}`);
      
      try {
        await prisma.page.update({
          where: { id: page.id },
          data: { slug: newSlug }
        });
        count++;
      } catch (error) {
        console.error(`Failed to update page ${page.id}: ${error.message}`);
        // If conflict, add random suffix
        const uniqueSlug = `${newSlug}-${Math.floor(Math.random() * 1000)}`;
        await prisma.page.update({
          where: { id: page.id },
          data: { slug: uniqueSlug }
        });
        count++;
      }
    }
  }

  console.log(`--- Migration Complete. Fixed ${count} pages. ---`);
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
