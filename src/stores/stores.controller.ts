import { Controller, Get, Param } from '@nestjs/common';
import { StoresService } from './stores.service';
import { PagesService } from '../pages/pages.service';

@Controller('stores')
export class StoresController {
    constructor(
        private readonly storesService: StoresService,
        private readonly pagesService: PagesService,
    ) { }

    @Get(':slug')
    async getStoreBySlug(@Param('slug') slug: string) {
        return this.storesService.getStoreBySlug(decodeURIComponent(slug));
    }

    @Get(':storeId/products/:productIdOrSlug')
    async getProduct(@Param('storeId') storeId: string, @Param('productIdOrSlug') productIdOrSlug: string) {
        return this.storesService.getProduct(storeId, decodeURIComponent(productIdOrSlug));
    }

    @Get(':slug/pages/:pageSlug')
    async getPublicPage(@Param('slug') slug: string, @Param('pageSlug') pageSlug: string) {
        return this.pagesService.getPublicPage(decodeURIComponent(pageSlug), decodeURIComponent(slug));
    }
}
