import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePageDto } from './dto/create-page.dto';
import { UpdatePageDto } from './dto/update-page.dto';
import { UpdatePageStatusDto } from './dto/update-page-status.dto';
import { generateSlug, sanitizeSlug } from '../utils/slug.util';
import { PageStatus, PageType } from '@prisma/client';

@Injectable()
export class PagesService {
  constructor(private prisma: PrismaService) {}

  private async getStoreIdByMerchant(userId: string): Promise<string> {
    const merchant = await this.prisma.merchant.findUnique({
      where: { userId },
      include: { store: true },
    });
    if (!merchant || !merchant.store) {
      throw new NotFoundException('Store not found for this merchant');
    }
    return merchant.store.id;
  }

  async createPage(dto: CreatePageDto, userId: string) {
    const storeId = await this.getStoreIdByMerchant(userId);

    if (dto.type === PageType.LANDING) {
      if (!dto.linkedProductId) {
        throw new BadRequestException(
          'linkedProductId is required for LANDING pages',
        );
      }

      // Verify product exists AND belongs to this store
      const product = await this.prisma.product.findFirst({
        where: {
          id: dto.linkedProductId,
          storeId,
        },
      });

      if (!product) {
        throw new BadRequestException('المنتج غير موجود أو لا ينتمي لمتجرك');
      }
    }

    const slug = dto.slug ? sanitizeSlug(dto.slug) : generateSlug(dto.title);

    // Ensure slug uniqueness per store
    const existing = await this.prisma.page.findUnique({
      where: { storeId_slug: { storeId, slug } },
    });
    if (existing) {
      throw new ConflictException('Slug already exists for this store');
    }

    return this.prisma.page.create({
      data: {
        ...dto,
        storeId,
        slug,
        status: PageStatus.DRAFT,
        content: (dto.content as any) || {
          version: 1,
          puckData: { content: [], root: { props: {} } },
        },
      },
    });
  }

  async getPages(userId: string) {
    const storeId = await this.getStoreIdByMerchant(userId);
    return this.prisma.page.findMany({
      where: { storeId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getPage(pageId: string, userId: string) {
    const storeId = await this.getStoreIdByMerchant(userId);
    const page = await this.prisma.page.findUnique({
      where: { id: pageId },
    });

    if (!page) throw new NotFoundException('Page not found');
    if (page.storeId !== storeId)
      throw new ForbiddenException('You do not own this page');

    return page;
  }

  async updatePage(pageId: string, dto: UpdatePageDto, userId: string) {
    const storeId = await this.getStoreIdByMerchant(userId);
    const page = await this.getPage(pageId, userId);

    const slug = dto.slug ? sanitizeSlug(dto.slug) : page.slug;

    if (dto.slug && dto.slug !== page.slug) {
      const existing = await this.prisma.page.findUnique({
        where: { storeId_slug: { storeId, slug } },
      });
      if (existing) {
        throw new ConflictException('Slug already exists for this store');
      }
    }

    if (page.type === PageType.LANDING && dto.linkedProductId) {
      const product = await this.prisma.product.findFirst({
        where: {
          id: dto.linkedProductId,
          storeId,
        },
      });
      if (!product) {
        throw new BadRequestException('المنتج غير موجود أو لا ينتمي لمتجرك');
      }
    }

    // Validate Puck JSON shape if content is provided
    if (dto.content) {
      if (typeof dto.content.version !== 'number') {
        throw new BadRequestException('Content must have a version field');
      }
      // If updating content, ensure we preserve or update the version correctly
      // In this task, we just store it as-is but validate basic shape
    }

    return this.prisma.page.update({
      where: { id: pageId },
      data: {
        ...dto,
        content: dto.content as any,
      },
    });
  }

  async updatePageStatus(
    pageId: string,
    dto: UpdatePageStatusDto,
    userId: string,
  ) {
    const page = await this.getPage(pageId, userId);

    const currentStatus = page.status;
    const newStatus = dto.status;

    // Transition rules:
    // DRAFT -> PUBLISHED: allowed
    // PUBLISHED -> DRAFT: allowed
    // PUBLISHED -> ARCHIVED: allowed
    // ARCHIVED -> DRAFT: allowed
    // ARCHIVED -> PUBLISHED: NOT allowed directly
    if (
      currentStatus === PageStatus.ARCHIVED &&
      newStatus === PageStatus.PUBLISHED
    ) {
      throw new BadRequestException('يجب استعادة الصفحة إلى مسودة أولاً');
    }

    return this.prisma.page.update({
      where: { id: pageId },
      data: { status: newStatus },
    });
  }

  async deletePage(pageId: string, userId: string) {
    const page = await this.getPage(pageId, userId);

    if (page.status === PageStatus.PUBLISHED) {
      throw new BadRequestException('لا يمكن حذف صفحة منشورة');
    }

    await this.prisma.page.delete({
      where: { id: pageId },
    });

    return { message: 'Page deleted successfully' };
  }

  /**
   * Returns the store's home page, creating it with a default v2 template if
   * it does not yet exist.  This is the safe entry-point for the "Customize
   * Home Page" button in the merchant dashboard.
   *
   * @param storeId — comes directly from req.activeStore.id (already validated
   *   by MerchantGuard), so no secondary store lookup is needed here.
   */
  async getOrCreateHomePage(storeId: string) {
    const existing = await this.prisma.page.findUnique({
      where: { storeId_slug: { storeId, slug: 'home' } },
    });

    if (existing) return existing;

    const defaultContent = {
      version: 2,
      puckData: {
        root: { props: {} },
        content: [
          {
            type: 'HeroBanner',
            props: {
              id: 'hero-home',
              title: 'مرحباً بكم في متجرنا',
              subtitle: 'اكتشف أفضل المنتجات بأفضل الأسعار',
              backgroundColor: 'primary',
              overlayOpacity: 'none',
              textColor: 'white',
              buttonLabel: 'تسوق الآن',
              buttonHref: '#',
              showButton: true,
              minHeight: 'md',
              contentAlign: 'center',
            },
          },
          {
            type: 'CategoriesSliderBlock',
            props: {
              id: 'cats-home',
              title: 'تسوق حسب الفئة',
              showViewAll: true,
              viewAllLabel: 'عرض الكل',
              imageRadius: 'full',
              itemsPerRow: '6',
            },
          },
          {
            type: 'ProductsSectionBlock',
            props: {
              id: 'products-home',
              title: 'عروض حصرية',
              showTitle: true,
              showViewAll: true,
              viewAllLabel: 'عرض المزيد',
              icon: '⚡',
              iconBgColor: 'red',
              limit: 8,
              colsMobile: '2',
              colsTablet: '3',
              colsDesktop: '4',
              gap: 'md',
              sortBy: 'newest',
              filterByCategory: '',
            },
          },
        ],
      },
    };

    return this.prisma.page.create({
      data: {
        storeId,
        slug: 'home',
        title: 'الصفحة الرئيسية',
        type: PageType.CUSTOM,
        status: PageStatus.DRAFT,
        showHeader: false,
        showFooter: false,
        content: defaultContent as any,
      },
    });
  }

  async getPublicPage(storeSlugOrId: string, pageSlugOrId: string) {
    const store = await this.prisma.store.findFirst({
      where: {
        OR: [{ slug: storeSlugOrId }, { id: storeSlugOrId }],
      },
    });
    
    if (!store) {
      throw new NotFoundException('Store not found');
    }

    const page = await this.prisma.page.findFirst({
      where: {
        AND: [
          { storeId: store.id },
          { status: PageStatus.PUBLISHED },
          {
            OR: [{ slug: pageSlugOrId }, { id: pageSlugOrId }],
          },
        ],
      },
    });

    if (!page) {
      throw new NotFoundException('Page not found');
    }

    return page;
  }
}
