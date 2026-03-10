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

        return { store };
    }
}
