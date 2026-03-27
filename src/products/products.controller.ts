import { Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards, Req } from '@nestjs/common';
import { ProductsService } from './products.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { CreateOfferDto } from './dto/create-offer.dto';
import { MerchantGuard } from '../merchant/guards/merchant.guard';
import { ProductStatus } from '@prisma/client';
import { Action } from '../common/enums/action.enum';
import { Resource } from '../common/enums/resource.enum';
import { Permissions } from '../common/decorators/permissions.decorator';

@Controller('merchant/products')
@UseGuards(MerchantGuard)
export class ProductsController {
    constructor(
        private readonly productsService: ProductsService,
    ) { }

    @Get()
    @Permissions(Resource.PRODUCTS, Action.READ)
    async getProducts(@Req() req, @Query('status') status?: ProductStatus) {
        return this.productsService.getProducts(req.activeStore.id, status);
    }

    @Get(':id')
    @Permissions(Resource.PRODUCTS, Action.READ)
    async getProductById(@Req() req, @Param('id') id: string) {
        return this.productsService.getProductById(req.activeStore.id, id);
    }

    @Post()
    @Permissions(Resource.PRODUCTS, Action.CREATE)
    async createProduct(@Req() req, @Body() dto: CreateProductDto) {
        return this.productsService.createProduct(req.activeStore.id, dto);
    }

    @Patch(':id')
    @Permissions(Resource.PRODUCTS, Action.UPDATE)
    async updateProduct(@Req() req, @Param('id') id: string, @Body() dto: UpdateProductDto) {
        return this.productsService.updateProduct(req.activeStore.id, id, dto);
    }

    @Delete(':id')
    @Permissions(Resource.PRODUCTS, Action.DELETE)
    async deleteProduct(@Req() req, @Param('id') id: string) {
        return this.productsService.deleteProduct(req.activeStore.id, id);
    }

    // ── Offers ──

    @Get(':id/offers')
    @Permissions(Resource.PRODUCTS, Action.READ)
    async getOffers(@Req() req, @Param('id') id: string) {
        return this.productsService.getOffers(req.activeStore.id, id);
    }

    @Post(':id/offers')
    @Permissions(Resource.PRODUCTS, Action.CREATE)
    async createOffer(@Req() req, @Param('id') id: string, @Body() dto: CreateOfferDto) {
        return this.productsService.createOffer(req.activeStore.id, id, dto);
    }

    @Patch(':id/offers/:offerId')
    @Permissions(Resource.PRODUCTS, Action.UPDATE)
    async updateOffer(@Req() req, @Param('id') id: string, @Param('offerId') offerId: string, @Body() dto: Partial<CreateOfferDto>) {
        return this.productsService.updateOffer(req.activeStore.id, id, offerId, dto);
    }

    @Delete(':id/offers/:offerId')
    @Permissions(Resource.PRODUCTS, Action.DELETE)
    async deleteOffer(@Req() req, @Param('id') id: string, @Param('offerId') offerId: string) {
        return this.productsService.deleteOffer(req.activeStore.id, id, offerId);
    }
}

