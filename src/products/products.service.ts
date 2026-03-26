import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { CreateOfferDto } from './dto/create-offer.dto';
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
            include: {
                options: {
                    include: { values: true }
                },
                variants: {
                    include: { optionValues: { include: { optionValue: true } } }
                }
            },
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
            include: {
                options: {
                    include: { values: true },
                    orderBy: { position: 'asc' }
                },
                variants: {
                    include: { optionValues: { include: { optionValue: true } } }
                }
            }
        });

        if (!product) {
            throw new NotFoundException('Product not found');
        }

        return product;
    }

    async createProduct(storeId: string, dto: CreateProductDto) {
        const { options, variants, ...productData } = dto;

        try {
            return await this.prisma.$transaction(async (tx) => {
                const product = await tx.product.create({
                    data: {
                        ...productData,
                        storeId,
                    },
                });

                if (options && options.length > 0) {
                    const optionValueMap = new Map<string, string>(); // "OptionName:ValueName" -> ID

                    for (const optDto of options) {
                        const option = await tx.productOption.create({
                            data: {
                                productId: product.id,
                                name: optDto.name,
                                type: optDto.type || 'DROPDOWN',
                                position: optDto.position || 0,
                                values: {
                                    create: optDto.values.map((v, i) => ({
                                        value: v.value,
                                        colorCode: v.colorCode || null,
                                        position: i
                                    }))
                                }
                            },
                            include: { values: true }
                        });

                        option.values.forEach(val => {
                            optionValueMap.set(`${optDto.name}:${val.value}`, val.id);
                        });
                    }

                    if (variants && variants.length > 0) {
                        for (const varDto of variants) {
                            const variant = await tx.productVariant.create({
                                data: {
                                    productId: product.id,
                                    sku: varDto.sku,
                                    price: varDto.price,
                                    comparePrice: varDto.comparePrice,
                                    quantity: varDto.quantity || 0,
                                    image: varDto.image,
                                    isActive: varDto.isActive ?? true,
                                }
                            });

                            // Link option values
                            // The varDto.optionValues should be in the same order as options if defined carefully,
                            // or we might need a more robust mapping. For now, assuming provided value names match.
                            for (let i = 0; i < varDto.optionValues.length; i++) {
                                const valName = varDto.optionValues[i];
                                const optName = options[i].name;
                                const valId = optionValueMap.get(`${optName}:${valName}`);

                                if (valId) {
                                    await tx.productVariantValue.create({
                                        data: {
                                            variantId: variant.id,
                                            optionValueId: valId
                                        }
                                    });
                                }
                            }
                        }
                    }
                }

                return product;
            });
        } catch (error) {
            if (error.code === 'P2002') {
                throw new ConflictException('Product slug already exists for this store');
            }
            throw error;
        }
    }

    async updateProduct(storeId: string, productId: string, dto: UpdateProductDto) {
        await this.getProductById(storeId, productId);
        const { options, variants, ...productData } = dto;

        try {
            return await this.prisma.$transaction(async (tx) => {
                // Update basic product info
                const product = await tx.product.update({
                    where: { id: productId },
                    data: productData,
                });

                // If options are provided, we replace the existing ones
                if (options !== undefined) {
                    // Delete existing options (cascades to values and variant values)
                    await tx.productOption.deleteMany({ where: { productId } });
                    // Delete existing variants
                    await tx.productVariant.deleteMany({ where: { productId } });

                    if (options.length > 0) {
                        const optionValueMap = new Map<string, string>();

                        for (const optDto of options) {
                            const option = await tx.productOption.create({
                                data: {
                                    productId,
                                    name: optDto.name,
                                    type: optDto.type || 'DROPDOWN',
                                    position: optDto.position || 0,
                                    values: {
                                        create: optDto.values.map((v, i) => ({
                                            value: v.value,
                                            colorCode: v.colorCode || null,
                                            position: i
                                        }))
                                    }
                                },
                                include: { values: true }
                            });

                            option.values.forEach(val => {
                                optionValueMap.set(`${optDto.name}:${val.value}`, val.id);
                            });
                        }

                        if (variants && variants.length > 0) {
                            for (const varDto of variants) {
                                const variant = await tx.productVariant.create({
                                    data: {
                                        productId,
                                        sku: varDto.sku,
                                        price: varDto.price,
                                        comparePrice: varDto.comparePrice,
                                        quantity: varDto.quantity || 0,
                                        image: varDto.image,
                                        isActive: varDto.isActive ?? true,
                                    }
                                });

                                for (let i = 0; i < varDto.optionValues.length; i++) {
                                    const valName = varDto.optionValues[i];
                                    const optName = options[i].name;
                                    const valId = optionValueMap.get(`${optName}:${valName}`);

                                    if (valId) {
                                        await tx.productVariantValue.create({
                                            data: {
                                                variantId: variant.id,
                                                optionValueId: valId
                                            }
                                        });
                                    }
                                }
                            }
                        }
                    }
                }

                return product;
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

    // ── Offers ──

    async getOffers(storeId: string, productId: string) {
        await this.getProductById(storeId, productId);
        return this.prisma.productOffer.findMany({
            where: { productId },
            orderBy: { sortOrder: 'asc' },
        });
    }

    async createOffer(storeId: string, productId: string, dto: CreateOfferDto) {
        await this.getProductById(storeId, productId);
        return this.prisma.productOffer.create({
            data: {
                productId,
                title: dto.title,
                description: dto.description,
                quantity: dto.quantity,
                price: dto.price,
                badge: dto.badge,
                sortOrder: dto.sortOrder,
                isActive: dto.isActive,
            },
        });
    }

    async updateOffer(storeId: string, productId: string, offerId: string, dto: Partial<CreateOfferDto>) {
        await this.getProductById(storeId, productId);
        const offer = await this.prisma.productOffer.findFirst({
            where: { id: offerId, productId },
        });
        if (!offer) throw new NotFoundException('Offer not found');

        return this.prisma.productOffer.update({
            where: { id: offerId },
            data: dto,
        });
    }

    async deleteOffer(storeId: string, productId: string, offerId: string) {
        await this.getProductById(storeId, productId);
        const offer = await this.prisma.productOffer.findFirst({
            where: { id: offerId, productId },
        });
        if (!offer) throw new NotFoundException('Offer not found');

        await this.prisma.productOffer.delete({ where: { id: offerId } });
        return { message: 'Offer deleted' };
    }
}
