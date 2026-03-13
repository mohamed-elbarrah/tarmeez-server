import { PrismaClient } from '@prisma/client';

export async function seedStoreData(prisma: any, storeId: string) {
  // 1. Define Categories with specific colors and placeholders
  const categories = [
    { name: 'إلكترونيات', slug: 'electronics', bg: 'e0f2fe', color: '0284c7' },
    { name: 'ملابس', slug: 'clothing', bg: 'fce7f3', color: 'db2777' },
    { name: 'إكسسوارات', slug: 'accessories', bg: 'fef9c3', color: 'ca8a04' },
    { name: 'جوالات', slug: 'phones', bg: 'dcfce7', color: '16a34a' },
    { name: 'المنزل', slug: 'home', bg: 'ede9fe', color: '7c3aed' },
    { name: 'جمال وعناية', slug: 'personal', bg: 'fce7f3', color: 'be185d' },
  ];

  const createdCategories: any[] = [];
  for (let i = 0; i < categories.length; i++) {
    const cat = categories[i];
    const category = await prisma.category.create({
      data: {
        storeId,
        name: cat.name,
        slug: cat.slug,
        image: `https://placehold.co/400x400/${cat.bg}/${cat.color}?text=${i + 1}`,
        sortOrder: i,
      },
    });
    createdCategories.push({ ...category, ...cat });
  }

  // 2. Define 10 Products spread across categories
  const productsData = [
    { name: 'ساعة ذكية برو', price: 299, catIdx: 0 },
    { name: 'تيشيرت قطن ناعم', price: 49, catIdx: 1 },
    { name: 'محفظة جلد طبيعي', price: 89, catIdx: 2 },
    { name: 'جوال ذكي ألترا', price: 999, catIdx: 3 },
    { name: 'مصباح طاولة عصري', price: 129, catIdx: 4 },
    { name: 'شامبو للعناية الفائقة', price: 25, catIdx: 5 },
    { name: 'سماعات عازلة للضوضاء', price: 199, catIdx: 0 },
    { name: 'بنطال جينز ضيق', price: 79, catIdx: 1 },
    { name: 'نظارات شمسية فاخرة', price: 150, catIdx: 2 },
    { name: 'شاحن لاسلكي سريع', price: 45, catIdx: 0 },
  ];

  for (let i = 0; i < productsData.length; i++) {
    const p = productsData[i];
    const cat = createdCategories[p.catIdx];
    const slug = `${p.name.toLowerCase().replace(/ /g, '-')}-${i}`;
    
    const product = await prisma.product.create({
      data: {
        storeId,
        name: p.name,
        slug,
        description: `هذا المنتج الـ ${p.name} عالي الجودة من مجموعة الـ ${cat.name} الخاصة بنا.`,
        price: p.price,
        comparePrice: p.price * 1.2,
        images: [`https://placehold.co/600x600/${cat.bg}/${cat.color}?text=${i + 1}`],
        category: cat.name,
        categoryId: cat.id,
        quantity: 100,
        status: 'ACTIVE',
        trackStock: true,
        isPhysical: true,
      },
    });

    // Add a default offer for some products
    if (i % 3 === 0) {
      await prisma.productOffer.create({
        data: {
          productId: product.id,
          title: 'عرض خاص',
          description: 'خصم لفترة محدودة',
          quantity: 1,
          price: product.price * 0.9,
          badge: 'تخفيضات',
          isActive: true,
        },
      });
    }
  }

  console.log(`Successfully seeded store ${storeId} with 6 categories and 10 products.`);
}
