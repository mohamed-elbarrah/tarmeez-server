import { PrismaClient } from '@prisma/client';

export async function seedStoreData(prisma: any, storeId: string) {
  // 1. Define 10 Generic Categories
  const categoryNames = [
    'الفئة 1', 'الفئة 2', 'الفئة 3', 'الفئة 4', 'الفئة 5',
    'الفئة 6', 'الفئة 7', 'الفئة 8', 'الفئة 9', 'الفئة 10'
  ];
  
  const colors = [
    { bg: 'e0f2fe', text: '0284c7' }, // Light Blue
    { bg: 'fce7f3', text: 'db2777' }, // Pink
    { bg: 'fef9c3', text: 'ca8a04' }, // Yellow
    { bg: 'dcfce7', text: '16a34a' }, // Green
    { bg: 'ede9fe', text: '7c3aed' }, // Purple
    { bg: 'ffedd5', text: 'ea580c' }, // Orange
    { bg: 'f1f5f9', text: '475569' }, // Slate
    { bg: 'ecfeff', text: '0891b2' }, // Cyan
    { bg: 'fff1f2', text: 'e11d48' }, // Rose
    { bg: 'f0fdf4', text: '16a34a' }, // Emerald
  ];

  const createdCategories: any[] = [];
  for (let i = 0; i < categoryNames.length; i++) {
    const name = categoryNames[i];
    const slug = `category-${i + 1}`;
    const clr = colors[i % colors.length];
    
    const category = await prisma.category.create({
      data: {
        storeId,
        name,
        slug,
        image: `https://placehold.co/400x400/${clr.bg}/${clr.text}?text=${i + 1}`,
        sortOrder: i,
      },
    });
    createdCategories.push({ ...category, ...clr });
  }

  // 2. Define 10 Generic Products
  for (let i = 0; i < 10; i++) {
    const productName = `العنصر ${i + 1}`;
    const slug = `element-${i + 1}-${Math.random().toString(36).substring(7)}`;
    const cat = createdCategories[i % createdCategories.length];
    const price = Math.floor(Math.random() * 900) + 100; // 100 to 1000

    // Donation Metadata Logic
    const targetAmount = Math.floor(Math.random() * 40000) + 10000;
    const currentAmount = Math.floor(Math.random() * targetAmount);
    
    const product = await prisma.product.create({
      data: {
        storeId,
        name: productName,
        slug,
        description: `هذا وصف توضيحي لـ ${productName}. يوفر هذا العنصر لمحة شاملة عن كيفية ظهور المنتجات والخدمات في منصة ترميز، سواء كانت نشاطًا تجاريًا أو جمعية خيرية.`,
        price,
        comparePrice: price * 1.5,
        images: [`https://placehold.co/600x600/${cat.bg}/${cat.text}?text=${i + 1}`],
        category: cat.name,
        categoryId: cat.id,
        quantity: 500,
        status: 'ACTIVE',
        trackStock: true,
        isPhysical: true,
        donationMetadata: {
          isDonation: true,
          targetAmount,
          currentAmount,
          donationOptions: [10, 50, 100, 500],
          allowCustomAmount: true,
          progressMessages: ["ساعدنا في الوصول للهدف", "تبقى القليل", "شكرًا لعطائكم"]
        }
      },
    });

    // 3. Add Options & Values
    const colorOpt = await prisma.productOption.create({
      data: {
        productId: product.id,
        name: 'اللون',
        position: 0,
        values: {
          create: [
            { value: 'أحمر', colorCode: '#ff0000', position: 0 },
            { value: 'أزرق', colorCode: '#0000ff', position: 1 },
            { value: 'أخضر', colorCode: '#00ff00', position: 2 },
          ]
        }
      },
      include: { values: true }
    });

    const sizeOpt = await prisma.productOption.create({
      data: {
        productId: product.id,
        name: 'المقاس',
        position: 1,
        values: {
          create: [
            { value: 'صغير', position: 0 },
            { value: 'متوسط', position: 1 },
            { value: 'كبير', position: 2 },
          ]
        }
      },
      include: { values: true }
    });

    const volumeOpt = await prisma.productOption.create({
      data: {
        productId: product.id,
        name: 'الحجم',
        position: 2,
        values: {
          create: [
            { value: '1 لتر', position: 0 },
            { value: '2 لتر', position: 1 },
            { value: '5 لتر', position: 2 },
          ]
        }
      },
      include: { values: true }
    });

    // 4. Create 3-5 Variants (Representational Sample)
    const variantCombinations = [
      [colorOpt.values[0].id, sizeOpt.values[0].id, volumeOpt.values[0].id],
      [colorOpt.values[1].id, sizeOpt.values[1].id, volumeOpt.values[1].id],
      [colorOpt.values[2].id, sizeOpt.values[2].id, volumeOpt.values[2].id],
    ];

    for (let vIdx = 0; vIdx < variantCombinations.length; vIdx++) {
      await prisma.productVariant.create({
        data: {
          productId: product.id,
          sku: `SKU-${i + 1}-V-${vIdx + 1}`,
          price: price + (vIdx * 10),
          quantity: 50,
          isActive: true,
          optionValues: {
            create: variantCombinations[vIdx].map(valId => ({
              optionValueId: valId
            }))
          }
        }
      });
    }

    // 5. Add 3 Marketing Offers
    const offers = [
      { title: 'عرض التوفير', price: price * 0.9, qty: 2, badge: 'الأكثر توفيراً' },
      { title: 'باكيت العودة', price: price * 0.85, qty: 3, badge: 'عرض خاص' },
      { title: 'العرض الذهبي', price: price * 0.75, qty: 5, badge: 'قيمة ممتازة' },
    ];

    for (let oIdx = 0; oIdx < offers.length; oIdx++) {
      const off = offers[oIdx];
      await prisma.productOffer.create({
        data: {
          productId: product.id,
          title: off.title,
          description: `احصل على ${off.qty} قطع بسعر خاص جداً.`,
          quantity: off.qty,
          price: off.price,
          badge: off.badge,
          sortOrder: oIdx,
          isActive: true,
        },
      });
    }
  }

  console.log(`Successfully seeded store ${storeId} with generic elements and charity metadata.`);
}
