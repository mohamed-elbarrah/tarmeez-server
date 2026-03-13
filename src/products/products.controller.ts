import { Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards, Req, NotFoundException } from '@nestjs/common';
import { ProductsService } from './products.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { CreateOfferDto } from './dto/create-offer.dto';
import { MerchantGuard } from '../merchant/guards/merchant.guard';
import { ProductStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Controller('merchant/products')
@UseGuards(MerchantGuard)
export class ProductsController {
    constructor(
        private readonly productsService: ProductsService,
        private readonly prisma: PrismaService,
    ) { }

    private async getStoreId(userId: string): Promise<string> {
        const merchant = await this.prisma.merchant.findUnique({
            where: { userId },
            include: { store: true },
        });

        if (!merchant || !merchant.store) {
            throw new NotFoundException('Store not found for this merchant');
        }

        return merchant.store.id;
    }

    @Get()
    async getProducts(@Req() req, @Query('status') status?: ProductStatus) {
        const storeId = await this.getStoreId(req.user.id);
        return this.productsService.getProducts(storeId, status);
    }

    @Get(':id')
    async getProductById(@Req() req, @Param('id') id: string) {
        const storeId = await this.getStoreId(req.user.id);
        return this.productsService.getProductById(storeId, id);
    }

    @Post()
    async createProduct(@Req() req, @Body() dto: CreateProductDto) {
        const storeId = await this.getStoreId(req.user.id);
        return this.productsService.createProduct(storeId, dto);
    }

    @Patch(':id')
    async updateProduct(@Req() req, @Param('id') id: string, @Body() dto: UpdateProductDto) {
        const storeId = await this.getStoreId(req.user.id);
        return this.productsService.updateProduct(storeId, id, dto);
    }

    @Delete(':id')
    async deleteProduct(@Req() req, @Param('id') id: string) {
        const storeId = await this.getStoreId(req.user.id);
        return this.productsService.deleteProduct(storeId, id);
    }

    // ── Offers ──

    @Get(':id/offers')
    async getOffers(@Req() req, @Param('id') id: string) {
        const storeId = await this.getStoreId(req.user.id);
        return this.productsService.getOffers(storeId, id);
    }

    @Post(':id/offers')
    async createOffer(@Req() req, @Param('id') id: string, @Body() dto: CreateOfferDto) {
        const storeId = await this.getStoreId(req.user.id);
        return this.productsService.createOffer(storeId, id, dto);
    }

    @Patch(':id/offers/:offerId')
    async updateOffer(@Req() req, @Param('id') id: string, @Param('offerId') offerId: string, @Body() dto: Partial<CreateOfferDto>) {
        const storeId = await this.getStoreId(req.user.id);
        return this.productsService.updateOffer(storeId, id, offerId, dto);
    }

    @Delete(':id/offers/:offerId')
    async deleteOffer(@Req() req, @Param('id') id: string, @Param('offerId') offerId: string) {
        const storeId = await this.getStoreId(req.user.id);
        return this.productsService.deleteOffer(storeId, id, offerId);
    }
}
