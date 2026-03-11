import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class StoresService {
    constructor(private prisma: PrismaService) { }

    async getStoreBySlug(slug: string) {
        const store = await this.prisma.store.findUnique({
            where: { slug },
            include: {
                merchant: {
                    select: {
                        fullName: true,
                        category: true,
                        city: true,
                        country: true,
                        description: true,
                    },
                },
                products: {
                    where: { status: 'ACTIVE' },
                    orderBy: { createdAt: 'desc' },
                    take: 8,
                    select: {
                        id: true,
                        name: true,
                        description: true,
                        price: true,
                        comparePrice: true,
                        images: true,
                        slug: true,
                        category: true,
                        status: true,
                        createdAt: true,
                    },
                },
            },
        });

        if (!store) {
            throw new NotFoundException('Store not found');
        }

        const s: any = store as any;

        // Map store and ensure brand identity fields are included in response
        return {
            store: {
                id: s.id,
                slug: s.slug,
                name: s.name,
                customDomain: s.customDomain,
                domainStatus: s.domainStatus,
                themeId: s.themeId,
                isOnboarded: s.isOnboarded,
                logo: s.logo,
                logoWidth: s.logoWidth,
                logoHeight: s.logoHeight,
                showStoreName: s.showStoreName,
                favicon: s.favicon,
                primaryColor: s.primaryColor,
                secondaryColor: s.secondaryColor,
                accentColor: s.accentColor,
                fontFamily: s.fontFamily,
                borderRadius: s.borderRadius,
                storeName: s.storeName,
                textColor: s.textColor,
                headingColor: s.headingColor,
                buttonColor: s.buttonColor,
                merchant: s.merchant,
                products: s.products,
            },
        };
    }
}
