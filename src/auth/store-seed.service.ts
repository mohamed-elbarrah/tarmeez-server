import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { generateSlug } from '../utils/slug.util';

const SEED_CATEGORIES = [
  { name: 'إلكترونيات',   description: 'أجهزة ومعدات إلكترونية',            image: 'https://placehold.co/600x600/e0f2fe/0284c7?text=%D8%A5%D9%84%D9%83%D8%AA%D8%B1%D9%88%D9%86%D9%8A%D8%A7%D8%AA' },
  { name: 'ملابس',        description: 'ملابس رجالية ونسائية وأطفال',        image: 'https://placehold.co/600x600/dbeafe/1d4ed8?text=%D9%85%D9%84%D8%A7%D8%A8%D8%B3' },
  { name: 'أحذية',        description: 'أحذية لجميع الأعمار',                image: 'https://placehold.co/600x600/fce7f3/be185d?text=%D8%A3%D8%AD%D8%B0%D9%8A%D8%A9' },
  { name: 'إكسسوارات',   description: 'إكسسوارات وإضافات أنيقة',           image: 'https://placehold.co/600x600/fef3c7/d97706?text=%D8%A5%D9%83%D8%B3%D8%B3%D9%88%D8%A7%D8%B1%D8%A7%D8%AA' },
  { name: 'منزل وديكور', description: 'مستلزمات المنزل والديكور',           image: 'https://placehold.co/600x600/d1fae5/065f46?text=%D9%85%D9%86%D8%B2%D9%84' },
  { name: 'رياضة',        description: 'معدات وملابس رياضية',                image: 'https://placehold.co/600x600/ede9fe/6d28d9?text=%D8%B1%D9%8A%D8%A7%D8%B6%D8%A9' },
  { name: 'كتب وتعليم',  description: 'كتب ومواد تعليمية',                  image: 'https://placehold.co/600x600/fee2e2/991b1b?text=%D9%83%D8%AA%D8%A8' },
  { name: 'جمال وعناية', description: 'منتجات التجميل والعناية الشخصية',   image: 'https://placehold.co/600x600/f0fdf4/166534?text=%D8%AC%D9%85%D8%A7%D9%84' },
  { name: 'أطفال',        description: 'ألعاب ومستلزمات الأطفال',           image: 'https://placehold.co/600x600/fff7ed/c2410c?text=%D8%A3%D8%B7%D9%81%D8%A7%D9%84' },
  { name: 'طعام وشراب',  description: 'منتجات غذائية ومشروبات',            image: 'https://placehold.co/600x600/f0f9ff/0369a1?text=%D8%B7%D8%B9%D8%A7%D9%85' },
] as const;

const SEED_PRODUCTS = [
  {
    name: 'هاتف ذكي متطور',
    description: 'هاتف ذكي بمواصفات عالية وأداء ممتاز',
    price: 1299,
    quantity: 50,
    categoryIndex: 0,
    images: ['https://placehold.co/600x600/e0f2fe/0284c7?text=1'],
  },
  {
    name: 'لابتوب احترافي',
    description: 'حاسوب محمول للمحترفين بمعالج قوي',
    price: 3499,
    quantity: 30,
    categoryIndex: 0,
    images: ['https://placehold.co/600x600/dbeafe/1d4ed8?text=2'],
  },
  {
    name: 'قميص رجالي كلاسيكي',
    description: 'قميص رجالي أنيق من قماش عالي الجودة',
    price: 149,
    quantity: 100,
    categoryIndex: 1,
    images: ['https://placehold.co/600x600/fce7f3/be185d?text=3'],
  },
  {
    name: 'فستان سهرة',
    description: 'فستان سهرة راقٍ مناسب لجميع المناسبات',
    price: 399,
    quantity: 40,
    categoryIndex: 1,
    images: ['https://placehold.co/600x600/fef3c7/d97706?text=4'],
  },
  {
    name: 'حذاء رياضي',
    description: 'حذاء رياضي مريح ومناسب للاستخدام اليومي',
    price: 259,
    quantity: 75,
    categoryIndex: 2,
    images: ['https://placehold.co/600x600/d1fae5/065f46?text=5'],
  },
  {
    name: 'ساعة ذكية',
    description: 'ساعة ذكية بميزات متعددة وتصميم عصري',
    price: 699,
    quantity: 60,
    categoryIndex: 3,
    images: ['https://placehold.co/600x600/ede9fe/6d28d9?text=6'],
  },
  {
    name: 'طقم غرفة معيشة',
    description: 'طقم أثاث عصري لغرفة المعيشة',
    price: 2999,
    quantity: 10,
    categoryIndex: 4,
    images: ['https://placehold.co/600x600/fee2e2/991b1b?text=7'],
  },
  {
    name: 'دمبل رياضي',
    description: 'دمبل متعدد الأوزان للتمارين المنزلية',
    price: 199,
    quantity: 80,
    categoryIndex: 5,
    images: ['https://placehold.co/600x600/f0fdf4/166534?text=8'],
  },
  {
    name: 'كتاب تعلم البرمجة',
    description: 'دليل شامل لتعلم البرمجة من الصفر',
    price: 89,
    quantity: 200,
    categoryIndex: 6,
    images: ['https://placehold.co/600x600/fff7ed/c2410c?text=9'],
  },
  {
    name: 'كريم ترطيب البشرة',
    description: 'كريم طبيعي لترطيب البشرة وإشراقها',
    price: 129,
    quantity: 150,
    categoryIndex: 7,
    images: ['https://placehold.co/600x600/f0f9ff/0369a1?text=10'],
  },
] as const;

@Injectable()
export class StoreSeedService {
  private readonly logger = new Logger(StoreSeedService.name);

  constructor(private readonly prisma: PrismaService) {}

  async seedStore(storeId: string): Promise<void> {
    this.logger.log(`Seeding store ${storeId}…`);

    // Create 10 categories
    const createdCategories = await Promise.all(
      SEED_CATEGORIES.map((cat, index) =>
        this.prisma.category.create({
          data: {
            storeId,
            name: cat.name,
            slug: generateSlug(cat.name),
            image: cat.image,
            sortOrder: index,
          },
        }),
      ),
    );

    // Create 10 products linked to their categories
    await Promise.all(
      SEED_PRODUCTS.map((prod) =>
        this.prisma.product.create({
          data: {
            storeId,
            name: prod.name,
            description: prod.description,
            price: prod.price,
            quantity: prod.quantity,
            slug: generateSlug(prod.name),
            status: 'ACTIVE',
            images: [...prod.images],
            categoryId: createdCategories[prod.categoryIndex].id,
          },
        }),
      ),
    );

    this.logger.log(
      `Seeding complete for store ${storeId}: 10 categories, 10 products`,
    );
  }
}
