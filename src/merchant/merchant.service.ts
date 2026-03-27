import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PaymentRegistry } from '../payments/payment.registry';

import { OrderStatus } from '@prisma/client';
import { UpdateSettingsDto } from './dto/update-settings.dto';


@Injectable()
export class MerchantService {
  constructor(private prisma: PrismaService) {}

  async getPaymentSettings(userId: string, registry: PaymentRegistry) {
    const merchant = await this.prisma.merchant.findUnique({
      where: { userId },
      include: { store: true },
    });
    if (!merchant || !merchant.store)
      throw new NotFoundException('Store not found');
    const enabled = merchant.store.enabledPaymentMethods || [];
    const available = registry
      .getAll()
      .map((g) => ({ key: (g as any).key, name: (g as any).name }));
    return { enabledMethods: enabled, available };
  }

  async updatePaymentSettings(userId: string, enabledMethods: string[]) {
    const merchant = await this.prisma.merchant.findUnique({
      where: { userId },
      include: { store: true },
    });
    if (!merchant || !merchant.store)
      throw new NotFoundException('Store not found');
    const updated = await this.prisma.store.update({
      where: { id: merchant.store.id },
      data: { enabledPaymentMethods: enabledMethods } as any,
    });
    return { enabledMethods: updated.enabledPaymentMethods };
  }

  async getOrders(
    userId: string,
    params: { status?: string; page?: number; limit?: number; search?: string },
  ) {
    const merchant = await this.prisma.merchant.findUnique({
      where: { userId },
      include: { store: true },
    });
    if (!merchant || !merchant.store)
      throw new NotFoundException('Store not found');
    const page = params.page && params.page > 0 ? params.page : 1;
    const limit = params.limit && params.limit > 0 ? params.limit : 20;
    const skip = (page - 1) * limit;

    const where: any = { storeId: merchant.store.id };
    if (params.status) where.status = params.status;
    if (params.search)
      where.orderCode = { contains: params.search, mode: 'insensitive' };

    const [[total, items], stats] = await Promise.all([
      Promise.all([
        this.prisma.order.count({ where }),
        this.prisma.order.findMany({
          where,
          include: { items: true },
          skip,
          take: limit,
          orderBy: { createdAt: 'desc' },
        }),
      ]),
      this.prisma.order.groupBy({
        by: ['status'],
        where: { storeId: merchant.store.id },
        _count: true,
      }),
    ]);

    const statsMap = stats.reduce(
      (acc, s) => {
        acc[s.status] = s._count;
        return acc;
      },
      {} as Record<string, number>,
    );

    return {
      total,
      page,
      limit,
      items,
      stats: {
        total: total,
        processing: (statsMap['PENDING'] || 0) + (statsMap['PROCESSING'] || 0),
        shipping: statsMap['SHIPPED'] || 0,
        completed: statsMap['DELIVERED'] || 0,
      },
    };
  }

  async getOrderByCode(userId: string, orderCode: string) {
    const merchant = await this.prisma.merchant.findUnique({
      where: { userId },
      include: { store: true },
    });
    if (!merchant || !merchant.store)
      throw new NotFoundException('Store not found');
    const order = await this.prisma.order.findFirst({
      where: { orderCode, storeId: merchant.store.id },
      include: { items: true },
    });
    if (!order) throw new NotFoundException('Order not found');
    return order;
  }

  async updateOrderStatus(
    userId: string,
    orderCode: string,
    status: OrderStatus,
  ) {
    const merchant = await this.prisma.merchant.findUnique({
      where: { userId },
      include: { store: true },
    });
    if (!merchant || !merchant.store)
      throw new NotFoundException('Store not found');
    const order = await this.prisma.order.findFirst({
      where: { orderCode, storeId: merchant.store.id },
    });
    if (!order) throw new NotFoundException('Order not found');
    const updated = await this.prisma.order.update({
      where: { id: order.id },
      data: { status } as any,
    });
    return updated;
  }

  async getMyStore(userId: string, storeId: string) {
    // Path 1: Store owner — has a Merchant record linked to this store
    const merchant = await this.prisma.merchant.findFirst({
      where: { userId, store: { id: storeId } },
      include: { store: true },
    });

    if (merchant?.store) {
      const store: any = merchant.store as any;
      return {
        merchant: {
          id: merchant.id,
          fullName: merchant.fullName,
          storeName: merchant.storeName,
          storeSlug: merchant.storeSlug,
          status: merchant.status,
        },
        store: {
          id: store.id,
          slug: store.slug,
          name: store.name,
          themeId: store.themeId,
          isOnboarded: store.isOnboarded,
          customDomain: store.customDomain,
          logo: store.logo,
          logoWidth: store.logoWidth,
          logoHeight: store.logoHeight,
          showStoreName: store.showStoreName,
          storeName: store.storeName,
          favicon: store.favicon,
          primaryColor: store.primaryColor,
          secondaryColor: store.secondaryColor,
          accentColor: store.accentColor,
          textColor: store.textColor,
          headingColor: store.headingColor,
          buttonColor: store.buttonColor,
          fontFamily: store.fontFamily,
          borderRadius: store.borderRadius,
        },
      };
    }

    // Path 2: Team member — has a StoreMember record, no Merchant record
    const membership = await this.prisma.storeMember.findFirst({
      where: { userId, storeId },
      include: { store: true },
    });

    if (!membership?.store) {
      throw new NotFoundException('Store not found for this account');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { name: true, email: true },
    });

    const store: any = membership.store as any;
    return {
      merchant: {
        id: userId,
        fullName: user?.name ?? user?.email ?? '',
        storeName: store.name,
        storeSlug: store.slug,
        status: 'ACTIVE' as const,
      },
      store: {
        id: store.id,
        slug: store.slug,
        name: store.name,
        themeId: store.themeId,
        isOnboarded: store.isOnboarded,
        customDomain: store.customDomain,
        logo: store.logo,
        logoWidth: store.logoWidth,
        logoHeight: store.logoHeight,
        showStoreName: store.showStoreName,
        storeName: store.storeName,
        favicon: store.favicon,
        primaryColor: store.primaryColor,
        secondaryColor: store.secondaryColor,
        accentColor: store.accentColor,
        textColor: store.textColor,
        headingColor: store.headingColor,
        buttonColor: store.buttonColor,
        fontFamily: store.fontFamily,
        borderRadius: store.borderRadius,
      },
    };
  }

  async getCustomers(
    userId: string,
    params: { search?: string; status?: string; page?: number; limit?: number },
  ) {
    const merchant = await this.prisma.merchant.findUnique({
      where: { userId },
      include: { store: true },
    });
    if (!merchant || !merchant.store)
      throw new NotFoundException('Store not found');

    const page = params.page && params.page > 0 ? params.page : 1;
    const limit = params.limit && params.limit > 0 ? params.limit : 20;
    const skip = (page - 1) * limit;

    const where: any = { storeId: merchant.store.id };
    if (params.status) where.status = params.status;
    if (params.search) {
      where.OR = [
        { fullName: { contains: params.search, mode: 'insensitive' } },
        { user: { email: { contains: params.search, mode: 'insensitive' } } },
      ];
    }

    const [total, customers] = await Promise.all([
      this.prisma.customer.count({ where }),
      this.prisma.customer.findMany({
        where,
        include: { user: true },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    const items = customers.map((c) => ({
      id: c.id,
      fullName: c.fullName,
      email: (c.user as any)?.email ?? null,
      phone: c.phone,
      status: c.status,
      createdAt: c.createdAt,
      ordersCount: 0,
      totalSpent: 0,
    }));

    return { total, page, limit, items };
  }

  async updateCustomerStatus(
    userId: string,
    customerId: string,
    status: 'ACTIVE' | 'BANNED',
  ) {
    const merchant = await this.prisma.merchant.findUnique({
      where: { userId },
      include: { store: true },
    });
    if (!merchant || !merchant.store)
      throw new NotFoundException('Store not found');

    // ensure customer belongs to the merchant's store
    const existing = await this.prisma.customer.findUnique({
      where: { id: customerId },
    });
    if (!existing || existing.storeId !== merchant.store.id)
      throw new NotFoundException('Customer not found');

    const updated = await this.prisma.customer.update({
      where: { id: customerId },
      data: { status } as any,
    });
    return { id: updated.id, status: updated.status };
  }

  async updateStoreCustomization(userId: string, dto: any) {
    const merchant = await this.prisma.merchant.findUnique({
      where: { userId },
      include: { store: true },
    });

    if (!merchant || !merchant.store) {
      throw new NotFoundException('Store not found');
    }

    // cast `data` as any to avoid TypeScript errors until Prisma Client is regenerated
    return this.prisma.store.update({
      where: { id: merchant.store.id },
      data: {
        logo: dto.logo,
        logoWidth: dto.logoWidth,
        logoHeight: dto.logoHeight,
        showStoreName: dto.showStoreName,
        storeName: dto.storeName,
        favicon: dto.favicon,
        primaryColor: dto.primaryColor,
        secondaryColor: dto.secondaryColor,
        accentColor: dto.accentColor,
        textColor: dto.textColor,
        headingColor: dto.headingColor,
        buttonColor: dto.buttonColor,
        fontFamily: dto.fontFamily,
        borderRadius: dto.borderRadius,
      } as any,
    });
  }

  async switchTheme(userId: string, themeId: string) {
    const merchant = await this.prisma.merchant.findUnique({
      where: { userId },
      include: { store: true },
    });

    if (!merchant || !merchant.store) {
      throw new NotFoundException('Store not found');
    }

    // Verify the theme exists and is active
    const theme = await (this.prisma as any).theme.findUnique({
      where: { id: themeId },
    });

    if (!theme || !theme.isActive) {
      throw new NotFoundException(
        `Theme '${themeId}' not found or is inactive`,
      );
    }

    const updated = await this.prisma.store.update({
      where: { id: merchant.store.id },
      data: { themeId } as any,
      select: { id: true, themeId: true },
    });


    return { storeId: updated.id, themeId: updated.themeId };
  }

  async getSettings(userId: string, storeId: string) {
    const store = await this.prisma.store.findUnique({
      where: { id: storeId },
      select: {
        id: true,
        slug: true,
        name: true,
        logo: true,
        favicon: true,
        supportEmail: true,
        supportWhatsapp: true,
        socialLinks: true,
        systemCurrency: true,
        currencyIcon: true,
        taxNumber: true,
        taxPercentage: true,
        isTaxEnabled: true,
      },
    });

    if (!store) {
      throw new NotFoundException('Store not found');
    }

    return store;
  }

  async updateSettings(userId: string, storeId: string, dto: UpdateSettingsDto) {
    // Cast to any to avoid TS errors until client is regenerated
    const data: any = {
      logo: dto.logo,
      favicon: dto.favicon,
      supportEmail: dto.supportEmail,
      supportWhatsapp: dto.supportWhatsapp,
      socialLinks: dto.socialLinks,
      systemCurrency: dto.systemCurrency,
      currencyIcon: dto.currencyIcon,
      taxNumber: dto.taxNumber,
      taxPercentage: dto.taxPercentage,
      isTaxEnabled: dto.isTaxEnabled,
    };


    // Filter out undefined values to only update provided fields
    Object.keys(data).forEach((key) => {
      if (data[key] === undefined) delete data[key];
    });

    const updated = await this.prisma.store.update({
      where: { id: storeId },
      data,
    });

    return updated;
  }
}
