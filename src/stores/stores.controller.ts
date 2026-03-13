import { Controller, Get, Param } from '@nestjs/common';
import { StoresService } from './stores.service';

@Controller('stores')
export class StoresController {
    constructor(private readonly storesService: StoresService) { }

    @Get(':slug')
    async getStoreBySlug(@Param('slug') slug: string) {
        return this.storesService.getStoreBySlug(decodeURIComponent(slug));
    }

    @Get(':storeId/products/:productIdOrSlug')
    async getProduct(@Param('storeId') storeId: string, @Param('productIdOrSlug') productIdOrSlug: string) {
        return this.storesService.getProduct(storeId, decodeURIComponent(productIdOrSlug));
    }
}
