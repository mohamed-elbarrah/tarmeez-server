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
}
