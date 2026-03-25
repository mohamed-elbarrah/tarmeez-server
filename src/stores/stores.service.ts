import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class StoresService {
    constructor(private prisma: PrismaService) { }

    async getStoreBySlug(slug: string) {
        const store = await (this.prisma.store as any).findUnique({
            where: { slug },
            include: {
                theme: {
                    select: {
                        id: true,
                        slug: true,
                        name: true,
                        previewImage: true,
                        defaultConfig: true,
                    },
                },
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
                        offers: {
                            where: { isActive: true },
                            orderBy: { sortOrder: 'asc' },
                        },
                        _count: { select: { reviews: true } },
                    },
                },
                categories: {
                    orderBy: { sortOrder: 'asc' },
                    select: {
                        id: true,
                        name: true,
                        slug: true,
                        image: true,
                        sortOrder: true,
                    },
                },
            },
        });

        if (!store) {
            throw new NotFoundException('Store not found');
        }

        // Compute average rating per product
        const productsWithRating: any[] = [];
        for (const product of (store as any).products) {
            const avg = await this.prisma.review.aggregate({
                where: { productId: product.id },
                _avg: { rating: true },
                _count: true,
            });
            productsWithRating.push({
                ...product,
                averageRating: avg._avg.rating ?? 0,
                reviewCount: avg._count,
            });
        }

        const s: any = store;

        // Map store and ensure brand identity fields are included in response
        return {
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
            products: productsWithRating,
            categories: s.categories,
        };
    }

    async getProduct(storeId: string, productIdOrSlug: string) {
        const product = await (this.prisma.product as any).findFirst({
            where: {
                storeId,
                OR: [
                    { id: productIdOrSlug },
                    { slug: productIdOrSlug },
                ],
            },
            include: {
                offers: {
                    where: { isActive: true },
                    orderBy: { sortOrder: 'asc' },
                },
                categoryRef: true,
                options: {
                    include: { values: true },
                    orderBy: { position: 'asc' },
                },
                variants: {
                    include: { optionValues: { include: { optionValue: true } } },
                },
                _count: { select: { reviews: true } },
            },
        });

        if (!product) {
            throw new NotFoundException('Product not found');
        }

        const avg = await this.prisma.review.aggregate({
            where: { productId: product.id },
            _avg: { rating: true },
            _count: true,
        });

        return {
            ...product,
            averageRating: avg._avg.rating ?? 0,
            reviewCount: avg._count,
        };
    }
}
