import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { ProductStatus } from '@prisma/client';

@Injectable()
export class ProductsService {
    constructor(private prisma: PrismaService) { }

    async getProducts(storeId: string, status?: ProductStatus) {
        const where: any = { storeId };
        if (status) {
            where.status = status;
        }

        const products = await this.prisma.product.findMany({
            where,
            orderBy: { createdAt: 'desc' },
        });

        const stats = {
            total: await this.prisma.product.count({ where: { storeId } }),
            active: await this.prisma.product.count({ where: { storeId, status: 'ACTIVE' } }),
            outOfStock: await this.prisma.product.count({ where: { storeId, quantity: 0 } }),
            drafts: await this.prisma.product.count({ where: { storeId, status: 'DRAFT' } }),
        };

        return { products, stats };
    }

    async getProductById(storeId: string, productId: string) {
        const product = await this.prisma.product.findFirst({
            where: { id: productId, storeId },
        });

        if (!product) {
            throw new NotFoundException('Product not found');
        }

        return product;
    }

    async createProduct(storeId: string, dto: CreateProductDto) {
        try {
            return await this.prisma.product.create({
                data: {
                    ...dto,
                    storeId,
                },
            });
        } catch (error) {
            if (error.code === 'P2002') {
                throw new ConflictException('Product slug already exists for this store');
            }
            throw error;
        }
    }

    async updateProduct(storeId: string, productId: string, dto: UpdateProductDto) {
        const product = await this.getProductById(storeId, productId);

        try {
            return await this.prisma.product.update({
                where: { id: productId },
                data: dto,
            });
        } catch (error) {
            if (error.code === 'P2002') {
                throw new ConflictException('Product slug already exists for this store');
            }
            throw error;
        }
    }

    async deleteProduct(storeId: string, productId: string) {
        await this.getProductById(storeId, productId);

        await this.prisma.product.delete({
            where: { id: productId },
        });

        return { message: 'Product deleted' };
    }
}
