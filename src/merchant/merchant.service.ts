import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class MerchantService {
  constructor(private prisma: PrismaService) { }

  async getMyStore(userId: string) {
    const merchant = await this.prisma.merchant.findUnique({
      where: { userId },
      include: { store: true },
    });

    if (!merchant) throw new NotFoundException('Merchant not found');
    if (!merchant.store) throw new NotFoundException('Store not found');

    return {
      merchant: {
        id: merchant.id,
        fullName: merchant.fullName,
        storeName: merchant.storeName,
        storeSlug: merchant.storeSlug,
        status: merchant.status,
      },
      store: {
        id: merchant.store.id,
        slug: merchant.store.slug,
        name: merchant.store.name,
        themeId: merchant.store.themeId,
        isOnboarded: merchant.store.isOnboarded,
        customDomain: merchant.store.customDomain,
        logo: merchant.store.logo,
        primaryColor: merchant.store.primaryColor,
        secondaryColor: merchant.store.secondaryColor,
        fontFamily: merchant.store.fontFamily,
      },
    };
  }

  async updateStoreCustomization(userId: string, dto: any) {
    const merchant = await this.prisma.merchant.findUnique({
      where: { userId },
      include: { store: true },
    });

    if (!merchant || !merchant.store) {
      throw new NotFoundException('Store not found');
    }

    return this.prisma.store.update({
      where: { id: merchant.store.id },
      data: {
        logo: dto.logo,
        primaryColor: dto.primaryColor,
        secondaryColor: dto.secondaryColor,
        fontFamily: dto.fontFamily,
      },
    });
  }
}
